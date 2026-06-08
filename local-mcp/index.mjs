import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";

const server = new Server({
    name: "vision-mcp-local",
    version: "1.0.0"
}, {
    capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "analyze_image",
                description: "Analyze an image and describe what is in it. Useful for pure text models to 'see' images.",
                inputSchema: {
                    type: "object",
                    properties: {
                        image_url: { type: "string", description: "The public URL of the image to analyze." },
                        image_path: { type: "string", description: "The absolute local file path of the image (e.g. C:/images/photo.png)." },
                        image_base64: { type: "string", description: "Base64 encoded image string." },
                        prompt: { type: "string", description: "Prompt or question about the image (e.g. 'Describe this image in detail')" }
                    },
                    required: ["prompt"]
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "analyze_image") {
        const { image_url, image_path, image_base64, prompt } = request.params.arguments;
        
        let finalImageUrl = image_base64 || image_url;

        if (image_path) {
            try {
                const ext = path.extname(image_path).substring(1) || 'jpeg';
                const fileData = fs.readFileSync(image_path);
                const base64Data = fileData.toString('base64');
                finalImageUrl = `data:image/${ext};base64,${base64Data}`;
            } catch (err) {
                throw new Error(`Failed to read local file ${image_path}: ${err.message}`);
            }
        }

        if (!finalImageUrl) {
            throw new Error("Must provide either image_url, image_path, or image_base64");
        }

        try {
            const response = await fetch("https://api.longcat.chat/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer ak_2Bg5gE19A8zv1kT9NH1o09vU2TF4y"
                },
                body: JSON.stringify({
                    model: "LongCat-2.0-Preview",
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                { type: "image_url", image_url: { url: finalImageUrl } }
                            ]
                        }
                    ],
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            return {
                content: [
                    { type: "text", text: data.choices[0].message.content }
                ]
            };
        } catch (error) {
            return {
                content: [
                    { type: "text", text: `Error analyzing image: ${error.message}` }
                ],
                isError: true
            };
        }
    }
    throw new Error("Tool not found");
});

// Run server using stdio transport
async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Vision MCP Server running on stdio");
}

run().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
