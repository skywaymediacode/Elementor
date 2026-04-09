const { v4: uuidv4 } = require('uuid');

/**
 * Enhances and validates Elementor JSON from AI output.
 * Converts any legacy section/column format to modern Container format.
 * Ensures all IDs are unique, structure is correct, and styles are properly formatted.
 * Strips out any raw HTML widgets and converts them to native widgets.
 */
function convertToElementor(aiJson, scrapeData) {
  if (!Array.isArray(aiJson)) {
    aiJson = [aiJson];
  }

  // Convert all elements — migrate sections/columns to containers
  const containers = aiJson.map(el => normalizeElement(el, scrapeData));

  // Strip any "html" widgets — replace with text-editor
  stripHtmlWidgets(containers);

  // Ensure unique IDs
  assignUniqueIds(containers);

  return containers;
}

/**
 * Normalize any element — convert sections/columns to containers,
 * validate widgets, recurse into children.
 */
function normalizeElement(el, scrapeData) {
  if (!el || typeof el !== 'object') return null;

  // Convert legacy "section" to "container"
  if (el.elType === 'section') {
    return convertSectionToContainer(el, scrapeData);
  }

  // Convert legacy "column" to "container"
  if (el.elType === 'column') {
    return convertColumnToContainer(el, scrapeData);
  }

  // Already a container
  if (el.elType === 'container') {
    return normalizeContainer(el, scrapeData);
  }

  // It's a widget
  if (el.elType === 'widget') {
    return normalizeWidget(el, scrapeData);
  }

  // Unknown elType — wrap as container
  return normalizeContainer({
    ...el,
    elType: 'container',
  }, scrapeData);
}

/**
 * Convert a legacy Elementor section into a modern Flexbox Container.
 */
function convertSectionToContainer(section, scrapeData) {
  const settings = { ...section.settings } || {};

  // Determine layout direction from columns
  const hasMultipleColumns = (section.elements || []).filter(e => e.elType === 'column').length > 1;

  const containerSettings = {
    flex_direction: hasMultipleColumns ? 'row' : 'column',
    content_width: settings.layout === 'full_width' ? 'full' : (settings.content_width || 'boxed'),
    flex_gap: settings.gap ? { size: parseInt(settings.gap) || 20, unit: 'px' } : { size: 20, unit: 'px' },
    flex_align_items: 'stretch',
  };

  // Carry over visual settings
  if (settings.background_color) {
    containerSettings.background_background = 'classic';
    containerSettings.background_color = ensureHex(settings.background_color);
  }
  if (settings.background_image) {
    containerSettings.background_background = 'classic';
    containerSettings.background_image = settings.background_image;
    containerSettings.background_position = settings.background_position || 'center center';
    containerSettings.background_size = settings.background_size || 'cover';
  }
  if (settings.padding) containerSettings.padding = normalizeSpacing(settings.padding);
  if (settings.margin) containerSettings.margin = normalizeSpacing(settings.margin);
  if (settings.min_height) containerSettings.min_height = settings.min_height;
  if (settings.border_radius) containerSettings.border_radius = normalizeSpacing(settings.border_radius);

  // Responsive
  if (settings.flex_direction_tablet) containerSettings.flex_direction_tablet = settings.flex_direction_tablet;
  if (settings.flex_direction_mobile) containerSettings.flex_direction_mobile = settings.flex_direction_mobile;
  if (!containerSettings.flex_direction_tablet && hasMultipleColumns) {
    containerSettings.flex_direction_tablet = 'column'; // Stack on tablet by default
  }

  const children = (section.elements || []).map(el => normalizeElement(el, scrapeData)).filter(Boolean);

  return {
    id: section.id || genId(),
    elType: 'container',
    settings: containerSettings,
    elements: children,
  };
}

/**
 * Convert a legacy column to a container.
 */
function convertColumnToContainer(column, scrapeData) {
  const settings = column.settings || {};
  const containerSettings = {
    flex_direction: 'column',
  };

  // Convert column size to flex width
  if (settings._column_size) {
    containerSettings.width = { size: settings._column_size, unit: '%' };
  }
  if (settings._inline_size) {
    containerSettings.width = { size: settings._inline_size, unit: '%' };
  }

  // Carry over visual settings
  if (settings.background_color) {
    containerSettings.background_background = 'classic';
    containerSettings.background_color = ensureHex(settings.background_color);
  }
  if (settings.padding) containerSettings.padding = normalizeSpacing(settings.padding);
  if (settings.margin) containerSettings.margin = normalizeSpacing(settings.margin);

  const children = (column.elements || []).map(el => normalizeElement(el, scrapeData)).filter(Boolean);

  return {
    id: column.id || genId(),
    elType: 'container',
    settings: containerSettings,
    elements: children,
  };
}

/**
 * Normalize an existing container element.
 */
function normalizeContainer(container, scrapeData) {
  const settings = normalizeSettings(container.settings || {}, 'container', scrapeData);

  // Ensure essential container settings
  if (!settings.flex_direction) settings.flex_direction = 'column';

  const children = (container.elements || []).map(el => normalizeElement(el, scrapeData)).filter(Boolean);

  return {
    id: container.id || genId(),
    elType: 'container',
    settings,
    elements: children,
  };
}

/**
 * Normalize a widget element. Convert "html" widgets to native alternatives.
 */
function normalizeWidget(widget, scrapeData) {
  let widgetType = widget.widgetType || 'text-editor';
  let settings = { ...(widget.settings || {}) };

  // CRITICAL: Convert raw HTML widgets to native text-editor
  if (widgetType === 'html') {
    widgetType = 'text-editor';
    if (settings.html) {
      settings.editor = settings.html;
      delete settings.html;
    }
  }

  settings = normalizeSettings(settings, widgetType, scrapeData);

  return {
    id: widget.id || genId(),
    elType: 'widget',
    widgetType,
    settings,
    elements: [],
  };
}

/**
 * Recursively strip "html" widgets and convert to text-editor.
 */
function stripHtmlWidgets(elements) {
  for (const el of elements) {
    if (el.elType === 'widget' && el.widgetType === 'html') {
      el.widgetType = 'text-editor';
      if (el.settings?.html) {
        el.settings.editor = el.settings.html;
        delete el.settings.html;
      }
    }
    if (el.elements) stripHtmlWidgets(el.elements);
  }
}

function normalizeSettings(settings, type, scrapeData) {
  const normalized = { ...settings };

  // Normalize spacing values
  ['padding', 'margin'].forEach(prop => {
    if (normalized[prop]) {
      normalized[prop] = normalizeSpacing(normalized[prop]);
    }
  });

  // Normalize font size
  if (normalized.typography_font_size) {
    if (typeof normalized.typography_font_size === 'number' || typeof normalized.typography_font_size === 'string') {
      normalized.typography_font_size = { size: parseInt(normalized.typography_font_size), unit: 'px' };
    }
  }

  // Normalize colors to hex
  ['title_color', 'text_color', 'background_color', 'button_text_color', 'color',
   'primary_color', 'secondary_color'].forEach(colorProp => {
    if (normalized[colorProp]) {
      normalized[colorProp] = ensureHex(normalized[colorProp]);
    }
  });

  // Ensure background_background is set when background_color is used
  if ((type === 'container' || type === 'section') && normalized.background_color) {
    if (!normalized.background_background) {
      normalized.background_background = 'classic';
    }
  }

  // Normalize image URLs
  if (normalized.image?.url && scrapeData?.images) {
    const img = scrapeData.images.find(i => i.originalUrl === normalized.image.url);
    if (img) {
      normalized.image.url = img.localPath || img.originalUrl;
    }
  }

  if (normalized.background_image?.url && scrapeData?.images) {
    const img = scrapeData.images.find(i => i.originalUrl === normalized.background_image.url);
    if (img) {
      normalized.background_image.url = img.localPath || img.originalUrl;
    }
  }

  return normalized;
}

function normalizeSpacing(value) {
  if (typeof value === 'string') {
    const val = parseInt(value) || 0;
    return { top: String(val), right: String(val), bottom: String(val), left: String(val), unit: 'px', isLinked: true };
  }
  if (typeof value === 'number') {
    return { top: String(value), right: String(value), bottom: String(value), left: String(value), unit: 'px', isLinked: true };
  }
  if (typeof value === 'object') {
    return {
      top: String(value.top || 0),
      right: String(value.right || 0),
      bottom: String(value.bottom || 0),
      left: String(value.left || 0),
      unit: value.unit || 'px',
      isLinked: value.isLinked ?? false,
    };
  }
  return value;
}

function ensureHex(color) {
  if (!color) return color;
  if (typeof color !== 'string') return color;
  if (color.startsWith('#')) return color;

  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  return color;
}

function assignUniqueIds(elements) {
  const usedIds = new Set();

  function walk(els) {
    for (const el of els) {
      if (!el.id || usedIds.has(el.id)) {
        el.id = genId();
      }
      usedIds.add(el.id);
      if (el.elements) walk(el.elements);
    }
  }

  walk(elements);
}

function genId() {
  return uuidv4().replace(/-/g, '').slice(0, 7);
}

module.exports = { convertToElementor };
