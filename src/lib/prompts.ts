export const BRAINSTORM_SYSTEM = `You are a creative children's book author and storyteller. Help brainstorm ideas for children's books. Consider the target age range and themes when making suggestions. Keep ideas age-appropriate, engaging, and educational. Respond in a friendly, encouraging tone.`

export const EXPAND_SYNOPSIS_SYSTEM = `You are a children's book editor. Given a story synopsis and details, expand it into a complete story arc with a clear beginning, middle, and end. Keep the language appropriate for the target age range. Output only the expanded synopsis text.`

export const GENERATE_ALL_PAGES_SYSTEM = `You are a children's book author. Given a story plan (title, synopsis, characters, themes, target age, and moral), break the story into individual pages for a picture book.

Rules:
- Each page should have 1-3 sentences appropriate for the target age range
- The text should be vivid and engaging, suitable for reading aloud
- Include the characters by name
- Build toward the moral/lesson naturally
- Return ONLY a JSON array of strings, where each string is one page's text
- No markdown, no code fences, just the JSON array

Example output:
["Page one text here.", "Page two text here.", "Page three text here."]`

export const REFINE_PAGE_TEXT_SYSTEM = `You are a children's book editor. Refine the given page text according to the instruction. Keep the core meaning but apply the requested change. Output ONLY the refined text, nothing else.`

export const IMAGE_SCENE_SYSTEM = `You are an art director for a children's picture book. Given a page's text and a CHARACTER REFERENCE SHEET, describe a single illustration that captures the scene.

CRITICAL — Character Consistency Rules:
- When a character appears in the scene, you MUST include their FULL visual description from the reference sheet in your output every time
- Always describe characters using their exact appearance details (species, colors, clothing, distinguishing features) — never use vague references like "the character" or "the hero"
- If multiple characters appear, describe EACH one with their complete visual details from the reference sheet
- This is essential: the illustrator has no memory between pages, so every scene description must be self-contained with full character appearances

CRITICAL — Color Rules:
- ALL illustrations MUST be in FULL COLOR. Never describe anything as black-and-white, grayscale, or monochrome
- Always specify vivid, rich colors for every element: characters, backgrounds, objects, and lighting
- Include specific color words (e.g., "bright red", "golden yellow", "deep green") rather than leaving colors ambiguous

Also be specific about:
- Character positions, poses, and facial expressions
- Setting and background details with colorful descriptions
- Key objects and actions happening
- Mood and lighting (use warm, colorful lighting descriptions)

Output ONLY the scene description. Do not include style directions (those are handled separately). Keep it under 150 words.`

export const GENERATE_STORY_PLAN_SYSTEM = `You are a creative children's book author. Given a user's idea or description, generate a complete story plan as a JSON object.

Rules:
- Create an engaging, age-appropriate story
- Include 2-4 well-developed characters with vivid visual descriptions suitable for an illustrator
- The synopsis should have a clear beginning, middle, and end (3-5 sentences)
- Themes should be 2-4 relevant keywords
- The moral should be a clear, simple lesson children can understand
- Return ONLY a valid JSON object with no markdown, no code fences, no explanation

Required JSON structure:
{
  "title": "string",
  "targetAgeRange": "0-2" | "3-5" | "6-8" | "9-12",
  "themes": ["string"],
  "characters": [
    {
      "name": "string",
      "description": "personality and backstory",
      "role": "protagonist" | "antagonist" | "supporting",
      "visualDescription": "detailed visual appearance for illustrator - clothing, colors, features, species"
    }
  ],
  "synopsis": "full story arc with beginning, middle, and end",
  "moral": "the lesson of the story"
}`

export function buildGenerateStoryPlanPrompt(userIdea: string, ageRange?: string): string {
  const parts: string[] = []
  parts.push(`Story idea: "${userIdea}"`)
  if (ageRange) parts.push(`Preferred target age range: ${ageRange} years`)
  parts.push('\nGenerate a complete story plan as JSON.')
  return parts.join('\n')
}

export function buildBrainstormPrompt(context: {
  title?: string;
  ageRange?: string;
  themes?: string[];
  existingSynopsis?: string;
  userRequest: string;
}): string {
  const parts: string[] = []
  if (context.title) parts.push(`Book title: "${context.title}"`)
  if (context.ageRange) parts.push(`Target age: ${context.ageRange} years`)
  if (context.themes?.length) parts.push(`Themes: ${context.themes.join(', ')}`)
  if (context.existingSynopsis) parts.push(`Current synopsis: ${context.existingSynopsis}`)
  parts.push(`\nRequest: ${context.userRequest}`)
  return parts.join('\n')
}

export function buildGenerateAllPagesPrompt(storyPlan: {
  title: string;
  targetAgeRange: string;
  synopsis: string;
  characters: Array<{ name: string; role: string; description: string }>;
  themes: string[];
  moral: string;
}, pageCount: number): string {
  return `Create ${pageCount} pages for this children's book:

Title: "${storyPlan.title}"
Target Age: ${storyPlan.targetAgeRange} years
Synopsis: ${storyPlan.synopsis}
Characters: ${storyPlan.characters.map(c => `${c.name} (${c.role}): ${c.description}`).join('; ')}
Themes: ${storyPlan.themes.join(', ')}
Moral/Lesson: ${storyPlan.moral}

Return a JSON array of exactly ${pageCount} strings.`
}

export function buildRefinePrompt(currentText: string, instruction: string): string {
  return `Current text: "${currentText}"\n\nInstruction: ${instruction}`
}

export function buildImageScenePrompt(
  pageText: string,
  characters?: Array<{ name: string; visualDescription: string }>
): string {
  const parts: string[] = []

  // Character reference sheet
  if (characters && characters.length > 0) {
    const charDescs = characters
      .filter((c) => c.name && c.visualDescription)
      .map((c) => `- ${c.name}: ${c.visualDescription}`)
    if (charDescs.length > 0) {
      parts.push(`CHARACTER REFERENCE SHEET (use these exact descriptions whenever a character appears):`)
      parts.push(charDescs.join('\n'))
      parts.push('')
    }
  }

  parts.push(`Page text: "${pageText}"`)
  parts.push('')
  parts.push('Describe the illustration for this page. Include the full visual description for every character that appears in this scene.')
  return parts.join('\n')
}

export function buildCoverImagePrompt(
  title: string,
  characters: Array<{ name: string; visualDescription: string }>,
  artStylePrompt: string,
  synopsis: string
): string {
  const parts: string[] = ['Full color children\'s book front cover illustration']
  if (artStylePrompt) parts.push(artStylePrompt)

  // Include main characters
  const mainChars = characters.filter((c) => c.visualDescription?.trim())
  if (mainChars.length > 0) {
    const charDescs = mainChars.map((c) => `${c.name}: ${c.visualDescription}`).join('. ')
    parts.push(`Characters: ${charDescs}`)
  }

  parts.push(`The cover should capture the essence of a story titled "${title}" about: ${synopsis}`)
  parts.push('Create an inviting, eye-catching cover scene that would make a child want to read the book. Show the main characters in a dynamic pose. Leave space at the top for the title text.')

  return parts.join('. ')
}

export function buildCharacterConsistencyBlock(
  characters: Array<{ name: string; visualDescription: string }>,
  artStyleCharVisuals?: Record<string, string>
): string {
  const merged = characters
    .filter((c) => c.name)
    .map((c) => {
      // Prefer art style visuals (user-overridden) over story plan visuals
      const visual = artStyleCharVisuals?.[c.name]?.trim() || c.visualDescription?.trim()
      return visual ? `${c.name}: ${visual}` : null
    })
    .filter((v): v is string => v !== null)

  if (merged.length === 0) return ''
  return `Character appearances (MUST match exactly on every page): ${merged.join('. ')}`
}
