import type {
  CourseVideo,
  TranscriptChunk,
  RAGResponse,
  SearchResponse,
  CourseStats,
} from '@/types';

// ─── Mock Videos (your actual 21 lessons) ─────────────────────────────────────

export const MOCK_VIDEOS: CourseVideo[] = [
  { number: 1,  title: 'Installing VS Code & How Websites Work',  duration: 1740, chunkCount: 87 },
  { number: 2,  title: 'Your First HTML Website',                 duration: 1620, chunkCount: 82 },
  { number: 3,  title: 'Basic Structure of an HTML Website',      duration: 600,  chunkCount: 31 },
  { number: 4,  title: 'Heading, Paragraphs and Links',           duration: 900,  chunkCount: 46 },
  { number: 5,  title: 'Image, Lists, and Tables in HTML',        duration: 1080, chunkCount: 54 },
  { number: 6,  title: 'SEO and Core Web Vitals in HTML',         duration: 720,  chunkCount: 38 },
  { number: 7,  title: 'Forms and Input Tags in HTML',            duration: 480,  chunkCount: 24 },
  { number: 8,  title: 'Inline & Block Elements in HTML',         duration: 540,  chunkCount: 29 },
  { number: 9,  title: 'Id & Classes in HTML',                    duration: 660,  chunkCount: 35 },
  { number: 10, title: 'Video, Audio & Media in HTML',            duration: 720,  chunkCount: 37 },
  { number: 11, title: 'Semantic Tags in HTML',                   duration: 480,  chunkCount: 25 },
  { number: 12, title: 'Exercise 1 - Pure HTML Media Player',     duration: 300,  chunkCount: 15 },
  { number: 13, title: 'Entities, Code Tag and More on HTML',     duration: 540,  chunkCount: 28 },
  { number: 14, title: 'Introduction to CSS',                     duration: 480,  chunkCount: 24 },
  { number: 15, title: 'Inline, Internal & External CSS',         duration: 600,  chunkCount: 32 },
  { number: 16, title: 'Exercise 1 - Solution & Shoutouts',       duration: 360,  chunkCount: 18 },
  { number: 17, title: 'CSS Selectors MasterClass',               duration: 540,  chunkCount: 29 },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', duration: 900, chunkCount: 47 },
  { number: 19, title: 'CSS Fonts, Text & Color Properties',      duration: 2400, chunkCount: 120 },
  { number: 20, title: 'Exercise 2 - CSS Challenge',              duration: 360,  chunkCount: 18 },
  { number: 21, title: 'Sample Video',                            duration: 60,   chunkCount: 3  },
];

// ─── Mock Transcript (for Video #18 as example) ───────────────────────────────

export const MOCK_TRANSCRIPT_18: TranscriptChunk[] = [
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 0,    end: 15,   text: "Welcome back! Today we'll be learning about the CSS Box Model." },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 15,   end: 45,   text: "Every HTML element can be considered as a rectangular box. This is the fundamental concept behind the box model." },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 45,   end: 90,   text: "The box model consists of four areas: content, padding, border, and margin." },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 90,   end: 140,  text: "The content area is where your text and images actually appear." },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 140,  end: 200,  text: "Padding is the space between the content and the border. It's inside the element." },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 200,  end: 260,  text: "The border wraps around the padding and content. You can control its width, style, and color." },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 260,  end: 314,  text: "Margin is the space outside the border. It pushes other elements away." },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 314,  end: 380,  text: "Let me show you a practical example. I'll create a box with some content inside." },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 380,  end: 442,  text: "Now I am giving box1 class to this div element. And applying CSS properties to it." },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 442,  end: 520,  text: "I will give box1 a padding of 20 pixels all around. See how the space inside increases." },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 520,  end: 600,  text: "Now adding a 2 pixel solid border. The border appears between the padding and the margin." },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 600,  end: 700,  text: "And finally let me add a margin of 30 pixels. This pushes the box away from other elements." },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 700,  end: 800,  text: "The box-sizing property is very important. By default it is content-box." },
  { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 800,  end: 900,  text: "If you set box-sizing to border-box, the padding and border are included in the element's total width and height. This is much easier to work with!" },
];

// ─── Mock RAG Responses ───────────────────────────────────────────────────────

const MOCK_RESPONSES: Record<string, RAGResponse> = {
  default: {
    answer: `Great question! Based on your course content, I found some relevant lessons that cover this topic.

The **CSS Box Model** is one of the most fundamental concepts in web development. It's covered in depth in **Video #18 — "CSS Box Model - Margin, Padding & Borders"**.

The box model describes how every HTML element is represented as a rectangular box with four layers:
- **Content** — the actual text/image
- **Padding** — space inside the border
- **Border** — surrounds the padding
- **Margin** — space outside the border, separating elements

I recommend starting at around **4:42** into Video #18 where the instructor begins the live coding demonstration.`,
    sources: [
      { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 249, end: 314, text: 'Every HTML element can be considered as a rectangular box. This is the fundamental concept behind the box model.', similarity: 0.94 },
      { number: 18, title: 'CSS Box Model - Margin, Padding & Borders', start: 442, end: 520, text: 'I am doing it in box1 — now I will give box1 class to this element and apply the CSS properties.', similarity: 0.87 },
      { number: 14, title: 'Introduction to CSS',                        start: 406, end: 450, text: 'This thing will be applied there — CSS rules cascade down and affect all matching elements.', similarity: 0.72 },
    ],
  },
  exercise: {
    answer: `Exercise 1 appears twice in your course!

**Video #12 — "Exercise 1 - Pure HTML Media Player"** presents the actual exercise challenge at the very beginning (00:00 onwards).

**Video #16 — "Exercise 1 - Solution & Shoutouts"** covers the full solution starting at approximately **00:06**. The instructor walks through the complete HTML media player solution and gives shoutouts to students who submitted solutions.

I recommend watching Video #12 first, trying the exercise yourself, then watching Video #16 for the solution walkthrough!`,
    sources: [
      { number: 16, title: 'Exercise 1 - Solution & Shoutouts',   start: 6,   end: 60,  text: "In today's video, I will solve that exercise and tell you the correct approach.", similarity: 0.96 },
      { number: 12, title: 'Exercise 1 - Pure HTML Media Player', start: 0,   end: 30,  text: 'Welcome to Exercise 1. In this exercise you have to build a pure HTML media player.', similarity: 0.91 },
    ],
  },
  flexbox: {
    answer: `**CSS Flexbox** is covered in detail in **Video #17 — "CSS Selectors MasterClass"** and related layout videos.

Flexbox is a CSS layout model that makes it easy to design flexible responsive layouts. Key concepts include:
- **display: flex** — makes a container a flex container
- **flex-direction** — row or column
- **justify-content** — main axis alignment
- **align-items** — cross axis alignment

The course covers practical flexbox examples with live coding. Start at **Video #17** and look for the layout sections.`,
    sources: [
      { number: 17, title: 'CSS Selectors MasterClass',             start: 747, end: 820, text: 'So this class will be applied in this. The selector targets all elements with this class name.', similarity: 0.82 },
      { number: 15, title: 'Inline, Internal & External CSS',       start: 200, end: 280, text: 'External CSS is the recommended way to style your web pages in production.', similarity: 0.71 },
    ],
  },
};

function getMockResponse(question: string): RAGResponse {
  const q = question.toLowerCase();
  if (q.includes('box model') || q.includes('margin') || q.includes('padding') || q.includes('border')) {
    return MOCK_RESPONSES.default;
  }
  if (q.includes('exercise 1') || q.includes('exercise one') || q.includes('media player')) {
    return MOCK_RESPONSES.exercise;
  }
  if (q.includes('flexbox') || q.includes('flex')) {
    return MOCK_RESPONSES.flexbox;
  }
  return MOCK_RESPONSES.default;
}

// ─── Mock Stats ───────────────────────────────────────────────────────────────

export const MOCK_STATS: CourseStats = {
  videoCount: 21,
  totalDurationSeconds: 18540,
  totalDurationHours: 5.2,
  totalChunks: 2045,
  embeddingsLoaded: true,
};

// ─── Mock API functions ───────────────────────────────────────────────────────

const MOCK_DELAY = 500; // ms

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function mockAskQuestion(question: string): Promise<RAGResponse> {
  // Simulate AI thinking time
  await delay(2500);
  return getMockResponse(question);
}

export async function mockGetVideos(): Promise<CourseVideo[]> {
  await delay(MOCK_DELAY);
  return MOCK_VIDEOS;
}

export async function mockGetVideo(id: number): Promise<CourseVideo & { transcript: TranscriptChunk[] }> {
  await delay(MOCK_DELAY);
  const video = MOCK_VIDEOS.find(v => v.number === id);
  if (!video) throw new Error(`Video #${id} not found`);
  return {
    ...video,
    transcript: id === 18 ? MOCK_TRANSCRIPT_18 : generateMockTranscript(video),
  };
}

export async function mockSearchCourse(query: string): Promise<SearchResponse> {
  await delay(1500);
  const q = query.toLowerCase();
  const results = MOCK_VIDEOS
    .filter(v =>
      v.title.toLowerCase().includes(q) ||
      q.split(' ').some(word => v.title.toLowerCase().includes(word))
    )
    .slice(0, 6)
    .map(v => ({
      number: v.number,
      title: v.title,
      start: Math.floor(Math.random() * (v.duration * 0.7)),
      end: Math.floor(Math.random() * (v.duration * 0.3) + v.duration * 0.7),
      text: `This lesson covers ${v.title.toLowerCase()}. The instructor explains key concepts with live coding examples.`,
      similarity: Math.random() * 0.3 + 0.65,
    }));
  return { query, results };
}

export async function mockGetStats(): Promise<CourseStats> {
  await delay(300);
  return MOCK_STATS;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function generateMockTranscript(video: CourseVideo): TranscriptChunk[] {
  const segments = Math.max(5, Math.floor(video.chunkCount / 4));
  const segDuration = video.duration / segments;
  return Array.from({ length: segments }, (_, i) => ({
    number: video.number,
    title: video.title,
    start: i * segDuration,
    end: (i + 1) * segDuration,
    text: `[${video.title}] Segment ${i + 1}: The instructor continues explaining ${video.title.toLowerCase()} with practical examples and live demonstrations.`,
  }));
}
