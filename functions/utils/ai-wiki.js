import { AIClient } from './ai-client.js';

function normalizeText(value) {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export class AIWikiGenerator {
  static prepareDataset(bookmarks = []) {
    const seen = new Map();
    const unique = [];
    const duplicateMap = new Map();

    for (const bookmark of bookmarks) {
      if (!bookmark?.url) continue;
      const url = bookmark.url.trim();
      let hostname = '';
      try {
        hostname = new URL(url).hostname.replace(/^www\./, '');
      } catch {
        hostname = url;
      }
      const title = normalizeText(bookmark.title || hostname);
      const key = `${hostname}:${title}`;

      if (seen.has(key)) {
        const existing = seen.get(key);
        duplicateMap.set(existing.id, [...(duplicateMap.get(existing.id) || []), bookmark]);
      } else {
        seen.set(key, bookmark);
        unique.push(bookmark);
      }
    }

    const categories = {};
    unique.forEach((bookmark) => {
      const key = bookmark.category_name || '未分类';
      categories[key] = categories[key] || { color: bookmark.category_color, items: [] };
      categories[key].items.push(bookmark);
    });

    return {
      unique,
      duplicates: duplicateMap,
      categories,
      stats: {
        total: bookmarks.length,
        unique: unique.length,
        duplicateGroups: duplicateMap.size
      }
    };
  }

  static buildMessages(dataset) {
    const condensed = dataset.unique.slice(0, 200).map((bookmark) => ({
      title: bookmark.title,
      url: bookmark.url,
      description: bookmark.description || '',
      category: bookmark.category_name || '未分类'
    }));

    const instruction = `
你是一名知识库结构化助手，请基于给定的书签数据生成一个中文 Wiki 结构，并输出 JSON。
请根据主题或用途对书签进行重新聚类，聚类数量 4-8 个区块即可，每个区块需要：
- title: 版块名称
- description: 版块说明，用 1-2 句概括
- tags: 相关标签数组
- bookmarks: 数组，每个包含 title、url、summary、category、duplicates（如有重复 URL 列出）

请勿添加虚构的链接，summary 应解释书签有什么价值。
`;

    return [
      {
        role: 'system',
        content: '你是一位信息架构师，擅长把混乱的书签整理成结构化内容。'
      },
      {
        role: 'user',
        content: [
          instruction,
          '书签数据(JSON):',
          JSON.stringify({
            stats: dataset.stats,
            bookmarks: condensed
          })
        ].join('\n')
      }
    ];
  }

  static async generate(bookmarks, env) {
    const dataset = this.prepareDataset(bookmarks);
    if (!dataset.unique.length) {
      return this.buildFallback(dataset);
    }

    try {
      const response = await AIClient.chatCompletion({
        env,
        messages: this.buildMessages(dataset),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'wiki_sections',
            schema: {
              type: 'object',
              properties: {
                sections: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      tags: {
                        type: 'array',
                        items: { type: 'string' }
                      },
                      bookmarks: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            url: { type: 'string' },
                            summary: { type: 'string' },
                            category: { type: 'string' },
                            duplicates: {
                              type: 'array',
                              items: { type: 'string' }
                            }
                          },
                          required: ['title', 'url']
                        }
                      }
                    },
                    required: ['title', 'bookmarks']
                  }
                }
              },
              required: ['sections']
            }
          }
        }
      });

      const parsed = JSON.parse(response);
      return this.composeSnapshot(parsed.sections || [], dataset);
    } catch (error) {
      console.error('AI wiki 生成失败，使用备用方案:', error);
      return this.buildFallback(dataset);
    }
  }

  static composeSnapshot(sections, dataset) {
    const normalizedSections = sections.map((section, idx) => ({
      id: `ai-section-${idx + 1}`,
      title: section.title || `AI 分组 ${idx + 1}`,
      description: section.description || '',
      tags: section.tags || [],
      bookmarks: (section.bookmarks || []).map((bookmark) => ({
        title: bookmark.title,
        url: bookmark.url,
        summary: bookmark.summary || '',
        category: bookmark.category || '',
        duplicates: bookmark.duplicates || []
      }))
    }));

    return {
      generated_at: new Date().toISOString(),
      stats: dataset.stats,
      sections: normalizedSections
    };
  }

  static buildFallback(dataset) {
    const sections = Object.entries(dataset.categories).map(([name, group], idx) => ({
      id: `fallback-${idx + 1}`,
      title: name,
      description: `该分组包含 ${group.items.length} 个书签，由 AI 备用逻辑生成。`,
      tags: [],
      bookmarks: group.items.map((bookmark) => ({
        title: bookmark.title,
        url: bookmark.url,
        summary: bookmark.description || bookmark.url,
        category: name,
        duplicates: (dataset.duplicates.get(bookmark.id) || []).map((item) => item.url)
      }))
    }));

    return {
      generated_at: new Date().toISOString(),
      stats: dataset.stats,
      sections
    };
  }
}
