import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, NoSuchToolError, tool } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const openai = createOpenAI({
    compatibility: "strict",
    apiKey: process.env.OPENAI_API_KEY,
});

const inputSchema = z.object({
    statusId: z.string().nonempty().regex(/^[0-9]/),
    textContent: z.string().min(0).max(280),
    images: z.array(z.union([z.string().startsWith("data:image/"), z.string().url()])).max(4),
    tags: z.array(z.string().nonempty()),
});

export const POST = async (request: NextRequest) => {
    try {
        const json = await request.json();

        // Validate input using inputSchema
        const validatedInput = inputSchema.parse(json);

        // Prepare the prompt for the LLM
        const prompt = `
        Analyze the following images and for each return an array of tag objects for each image.
        Include and identify if image contains the following  mandatory tags: [${validatedInput.tags.join(", ")}].
        But also include any other tags you think are relevant to describe the image.
        Each tag object should have the structure {id: "tag-name", value: true/false}.
        If no images are provided, return an empty array.
        `;

        const schema = z.object({ id: z.string(), value: z.boolean() }).array().array();
        // Use generateText with experimental repair logic
        const result = await generateObject({
            model: openai('gpt-4o-mini', { structuredOutputs: true }),
            schemaName: 'tagging',
            schemaDescription: 'tags images',
            schema: z.object({result: schema}),
            messages: [
                { role: 'system', content: prompt },
                {
                    role: 'user',
                    content: [
                        ...validatedInput.images.map((image) => ({
                            type: 'image', image,
                            detail: 'low',
                            providerOptions: {
                                openai: { imageDetail: 'low' },
                            },
                        })) as {
                            type: 'image';
                            detail: string;
                            image: string;
                            providerOptions: {
                                openai: { imageDetail: string },
                            },
                        }[],
                    ],
                },
            ],
        });

        schema.parse(result.object.result);

        console.log({...result})

        const parsed = result.object.result.map(imageObject => imageObject.map((tagObject) => {
            return {
                id: tagObject.id,
                value: tagObject.value,
                mandatory: validatedInput.tags.includes(tagObject.id),
            };
        }));

        // Return the result
        return NextResponse.json({ result: parsed });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
};