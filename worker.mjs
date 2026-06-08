import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID()
});

const server = new Server({
    name: "vision-mcp",
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
                        image_base64: { type: "string", description: "Base64 encoded image string (optional, use image_url preferred)." },
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
        const { image_url, image_base64, prompt } = request.params.arguments;
        
        if (!image_url && !image_base64) {
            throw new Error("Must provide either image_url or image_base64");
        }

        const finalImageUrl = image_base64 || image_url;

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

// Connect server to transport
server.connect(transport).catch(console.error);

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // Simple REST API for the frontend UI
        if (url.pathname === "/api/analyze" && request.method === "POST") {
            try {
                const body = await request.json();
                const { image_base64, prompt } = body;
                
                if (!image_base64) {
                    return new Response("Missing image_base64", { status: 400 });
                }

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
                                    { type: "text", text: prompt || "描述这张图片" },
                                    { type: "image_url", image_url: { url: image_base64 } }
                                ]
                            }
                        ],
                        max_tokens: 1000
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    return new Response(`API Error: ${response.status} ${errorText}`, { status: 500 });
                }

                const data = await response.json();
                return new Response(data.choices[0].message.content, {
                    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "text/plain;charset=UTF-8" }
                });
            } catch (err) {
                return new Response(`Error: ${err.message}`, { status: 500 });
            }
        }

        // Route MCP requests
        if (url.pathname.startsWith("/mcp")) {
            // Add CORS headers for local development testing
            if (request.method === "OPTIONS") {
                return new Response(null, {
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                        "Access-Control-Allow-Headers": "Content-Type",
                    }
                });
            }

            const response = await transport.handleRequest(request);
            
            // Add CORS to actual responses
            const newHeaders = new Headers(response.headers);
            newHeaders.set("Access-Control-Allow-Origin", "*");
            
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders
            });
        }
        
        // Serve static assets for all other routes
        return env.ASSETS.fetch(request);
    }
};
