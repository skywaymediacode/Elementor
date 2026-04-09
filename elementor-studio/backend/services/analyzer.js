const Anthropic = require('@anthropic-ai/sdk');

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const CONVERTER_SYSTEM_PROMPT = `You are an expert Elementor developer. You receive scraped website data and must output a complete Elementor page JSON that recreates the site pixel-perfectly using ONLY native Elementor Containers and Widgets.

CRITICAL RULES:
1. NEVER use elType "section" or "column" — these are deprecated. Use ONLY elType "container" (Elementor Flexbox Containers).
2. NEVER use the "html" widgetType with raw HTML code. Every element MUST be a native Elementor widget.
3. Everything must be editable in Elementor's visual editor by non-technical users.
4. Clients will click on elements in the Elementor editor to change text, colors, images — so every piece of content must be its own widget.

STRUCTURE (Elementor Container-based / Flexbox):
- Root: JSON array of container objects
- Container: { "id": "7char", "elType": "container", "settings": { "flex_direction": "column"|"row", "content_width": "full"|"boxed", ... }, "elements": [] }
- Containers can nest other containers (for rows within sections)
- Widgets go inside containers: { "id": "7char", "elType": "widget", "widgetType": "heading", "settings": {...}, "elements": [] }

CONTAINER SETTINGS:
- flex_direction: "column" (stack vertically) or "row" (side by side)
- content_width: "full" or "boxed"
- flex_gap: { "size": 20, "unit": "px" }
- flex_align_items: "center" | "flex-start" | "flex-end" | "stretch"
- flex_justify_content: "center" | "flex-start" | "flex-end" | "space-between" | "space-around"
- background_background: "classic"
- background_color: "#hex"
- background_image: { "url": "...", "id": "" }
- background_position: "center center"
- background_size: "cover"
- padding: { "top": "80", "right": "40", "bottom": "80", "left": "40", "unit": "px", "isLinked": false }
- margin: { "top": "0", "right": "0", "bottom": "0", "left": "0", "unit": "px" }
- border_radius: { "top": "0", "right": "0", "bottom": "0", "left": "0", "unit": "px" }
- box_shadow_box_shadow: { "horizontal": 0, "vertical": 4, "blur": 20, "spread": 0, "color": "rgba(0,0,0,0.1)" }
- min_height: { "size": 600, "unit": "px" }
- For responsive: add _tablet or _mobile suffix (e.g., flex_direction_tablet: "column")

MAP HTML TO NATIVE ELEMENTOR WIDGETS (never use raw HTML):
- Navigation/menus → widgetType: "nav-menu" with menu settings
- Headings (h1-h6) → widgetType: "heading" with { title, header_size, title_color, typography_font_family, typography_font_size, typography_font_weight }
- Paragraphs/text → widgetType: "text-editor" with { editor: "<p>text here</p>" } (minimal HTML only for formatting, NOT for layout)
- Buttons → widgetType: "button" with { text, link: {url}, button_text_color, background_color, border_radius, typography_font_family }
- Images → widgetType: "image" with { image: {url, id}, image_size: "full" }
- Icons → widgetType: "icon" with { selected_icon: {value, library}, primary_color }
- Icon + text cards → widgetType: "icon-box" with { selected_icon, title_text, description_text }
- Image + text cards → widgetType: "image-box" with { image, title_text, description_text }
- Testimonials → widgetType: "testimonial" with { testimonial_content, testimonial_name, testimonial_job }
- Star ratings → widgetType: "star-rating" with { rating }
- Counters/stats → widgetType: "counter" with { starting_number, ending_number, title }
- Progress bars → widgetType: "progress" with { title, percent }
- Forms → widgetType: "form" (Elementor Pro) with form_fields array
- Social links → widgetType: "social-icons" with social_icon_list array
- Dividers/lines → widgetType: "divider" with { style, weight, color }
- Spacers → widgetType: "spacer" with { space: {size, unit} }
- Accordions → widgetType: "accordion" with tabs array
- Tabs → widgetType: "tabs" with tabs array
- Image galleries → widgetType: "image-gallery" or "image-carousel"
- Video embeds → widgetType: "video" with { video_type, youtube_url or vimeo_url }
- Google Maps → widgetType: "google_maps" with { address }
- Price tables → widgetType: "price-table" with { heading, sub_heading, price, features_list }
- Lists → widgetType: "icon-list" with { icon_list: [{text, selected_icon}] }

LAYOUT PATTERNS (use nested containers):
- Full-width hero: Container(full, column, bg-image) → Heading + Text + Button
- Card grid: Container(row, gap:20) → [Container(column), Container(column), Container(column)]
- Two columns: Container(row) → Container(50%) + Container(50%)
- Header: Container(row, justify:space-between) → Image(logo) + Nav-menu
- Footer: Container(row) → Container(col) + Container(col) + Container(col)

IMPORTANT FOR EDITABILITY:
- Each text element MUST be its own "heading" or "text-editor" widget — users click these to edit
- Each image MUST be its own "image" widget — users click to replace
- Each button MUST be its own "button" widget — users click to edit text/link
- NEVER combine multiple pieces of content into one text-editor widget
- NEVER use the "html" widget — everything must be native widgets

Match exact: font families, font sizes (px), colors (hex), spacing, padding, margins, border-radius, shadows.

Output ONLY valid Elementor page JSON. No explanation. No markdown. No code fences. Raw JSON array only.`;

const EDITOR_SYSTEM_PROMPT = `You are an expert Elementor developer working inside a live WordPress site. The site uses Elementor Flexbox Containers (NOT the old section/column system). You have access to the current Elementor JSON for this page.

When the user asks you to make a change (in plain English — they are NOT technical), you must:
1. Understand what they want changed (they'll say things like "change my phone number", "make the header blue", "add a new service")
2. Find the right widget(s) in the JSON
3. Output a JSON response with this exact structure:
{
  "description": "Friendly one-sentence description of what was changed (speak to the client, not a developer)",
  "patches": [
    {
      "action": "update" | "add" | "delete" | "reorder",
      "widgetId": "string - the id of the widget/container to modify",
      "parentId": "string - only for add action, the parent container id",
      "path": "string - dot-notation path into the widget settings (for update)",
      "value": "any - new value (for update) or new widget object (for add)",
      "newPosition": "number - only for reorder action",
      "position": "number - only for add action, insertion index",
      "preview": "string - one-sentence description of what changed"
    }
  ]
}

CRITICAL: When adding new elements, ALWAYS use native Elementor containers and widgets. NEVER output raw HTML widgets. New elements must be:
- Containers: { "elType": "container", "settings": {...}, "elements": [...] }
- Widgets: { "elType": "widget", "widgetType": "heading"|"text-editor"|"button"|"image"|etc, "settings": {...}, "elements": [] }

Common Elementor settings paths:
- Heading text: title
- Heading color: title_color
- Heading tag: header_size (h1, h2, h3, etc.)
- Text editor content: editor (use <p>text</p> only, no complex HTML)
- Button text: text
- Button link: link.url
- Button color: button_text_color
- Button background: background_color
- Container background color: background_color (also set background_background: "classic")
- Container background image: background_image.url
- Container flex direction: flex_direction ("row" or "column")
- Image source: image.url
- Font family: typography_font_family
- Font size: typography_font_size (object: {size: 16, unit: "px"})
- Font weight: typography_font_weight
- Padding: padding (object: {top, right, bottom, left, unit, isLinked})
- Margin: margin (object: {top, right, bottom, left, unit, isLinked})
- Text alignment: align
- Icon box title: title_text
- Icon box description: description_text
- Testimonial content: testimonial_content
- Testimonial name: testimonial_name
- Counter number: ending_number

Output ONLY valid JSON. No explanation. No markdown. No code fences.`;

async function analyzeAndConvert(scrapeData, sourceType) {
  const client = getClient();

  // Build the prompt with scraped data
  const prompt = buildConversionPrompt(scrapeData, sourceType);

  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-5-20241022',
        max_tokens: 16000,
        system: CONVERTER_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: attempt === 0
              ? prompt
              : `${prompt}\n\nPREVIOUS ATTEMPT FAILED WITH ERROR: ${lastError}\n\nPlease fix the JSON and try again. Output ONLY valid JSON.`,
          },
        ],
      });

      const responseText = message.content[0].text.trim();

      // Try to extract JSON from the response
      let json;
      try {
        json = JSON.parse(responseText);
      } catch {
        // Try to find JSON array in the response
        const match = responseText.match(/\[[\s\S]*\]/);
        if (match) {
          json = JSON.parse(match[0]);
        } else {
          throw new Error('Response is not valid JSON array');
        }
      }

      // Validate it's an array
      if (!Array.isArray(json)) {
        if (json.elements) json = json.elements;
        else json = [json];
      }

      // Validate basic Elementor structure
      validateElementorJson(json);

      return json;
    } catch (err) {
      lastError = err.message;
      console.error(`Conversion attempt ${attempt + 1} failed:`, err.message);
    }
  }

  throw new Error(`Failed to generate valid Elementor JSON after 3 attempts: ${lastError}`);
}

async function processEditRequest(message, currentJson, chatHistory) {
  const client = getClient();

  const messages = [];

  // Add chat history
  for (const msg of chatHistory.slice(-18)) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Ensure messages alternate properly
  const cleanMessages = [];
  let lastRole = null;
  for (const msg of messages) {
    if (msg.role === lastRole) continue;
    cleanMessages.push(msg);
    lastRole = msg.role;
  }

  // Make sure it ends with user message and starts properly
  if (cleanMessages.length === 0 || cleanMessages[cleanMessages.length - 1].role !== 'user') {
    cleanMessages.push({ role: 'user', content: message });
  }

  // Ensure first message is from user
  if (cleanMessages[0]?.role !== 'user') {
    cleanMessages.unshift({ role: 'user', content: 'Hello' });
  }

  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20241022',
        max_tokens: 8000,
        system: `${EDITOR_SYSTEM_PROMPT}\n\nCurrent Elementor JSON for reference:\n${JSON.stringify(currentJson).substring(0, 12000)}`,
        messages: attempt === 0
          ? cleanMessages
          : [
              ...cleanMessages,
              { role: 'assistant', content: 'Let me fix that.' },
              { role: 'user', content: `The previous response was invalid JSON: ${lastError}. Please output ONLY valid JSON with the structure specified.` },
            ],
      });

      const responseText = response.content[0].text.trim();

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        const match = responseText.match(/\{[\s\S]*\}/);
        if (match) {
          result = JSON.parse(match[0]);
        } else {
          throw new Error('Response is not valid JSON');
        }
      }

      // Validate response structure
      if (!result.description) result.description = 'Change applied';
      if (!result.patches) {
        if (result.action) {
          result = { description: result.preview || 'Change applied', patches: [result] };
        } else {
          throw new Error('No patches found in response');
        }
      }

      return result;
    } catch (err) {
      lastError = err.message;
      console.error(`Edit attempt ${attempt + 1} failed:`, err.message);
    }
  }

  throw new Error(`Failed to process edit after 3 attempts: ${lastError}`);
}

function buildConversionPrompt(scrapeData, sourceType) {
  let prompt = `Convert this ${sourceType || 'website'} to Elementor JSON.\n\n`;
  prompt += `Source URL: ${scrapeData.url}\n`;
  prompt += `Page Title: ${scrapeData.title || 'Untitled'}\n\n`;

  if (scrapeData.colors?.length) {
    prompt += `Color Palette: ${scrapeData.colors.join(', ')}\n\n`;
  }

  if (scrapeData.fonts?.length) {
    prompt += `Fonts Used: ${scrapeData.fonts.join(', ')}\n\n`;
  }

  if (scrapeData.sections?.length) {
    prompt += `Page Sections (${scrapeData.sections.length} found):\n\n`;
    for (const section of scrapeData.sections) {
      prompt += `--- ${section.role.toUpperCase()} ---\n`;
      prompt += `Tag: ${section.tag || 'div'}\n`;
      if (section.text) prompt += `Text Content: ${section.text.substring(0, 1000)}\n`;
      if (section.styles) {
        prompt += `Styles: ${JSON.stringify(section.styles)}\n`;
      }
      if (section.dimensions) {
        prompt += `Dimensions: ${JSON.stringify(section.dimensions)}\n`;
      }
      prompt += `\n`;
    }
  }

  if (scrapeData.images?.length) {
    prompt += `Images (${scrapeData.images.length}):\n`;
    scrapeData.images.slice(0, 20).forEach((img, i) => {
      prompt += `  ${i + 1}. ${img.alt || 'No alt text'} - ${img.originalUrl || img.filename}\n`;
    });
    prompt += '\n';
  }

  // Include a portion of the HTML for reference
  if (scrapeData.html) {
    const trimmedHtml = scrapeData.html.substring(0, 8000);
    prompt += `\nPage HTML (truncated):\n${trimmedHtml}\n`;
  }

  return prompt;
}

function validateElementorJson(json) {
  if (!Array.isArray(json)) throw new Error('Root must be an array');

  for (const section of json) {
    if (!section.id) throw new Error('Each section must have an id');
    if (!section.elType) throw new Error('Each section must have an elType');
    if (!section.settings || typeof section.settings !== 'object') {
      section.settings = {};
    }
    if (!section.elements) section.elements = [];
  }

  return true;
}

module.exports = { analyzeAndConvert, processEditRequest };
