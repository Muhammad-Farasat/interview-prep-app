export interface Question {
  id: string;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tip: string;
}

export interface Role {
  id: string;
  label: string;
  icon: string; // emoji
  questions: Question[];
}

export const ROLES: Role[] = [
  {
    id: 'frontend',
    label: 'Frontend Developer',
    icon: '🎨',
    questions: [
      {
        id: 'fe-1',
        text: 'What is the difference between HTML, CSS, and JavaScript?',
        difficulty: 'easy',
        tip: 'Think of HTML as structure, CSS as style, JS as behavior',
      },
      {
        id: 'fe-2',
        text: 'What is the CSS box model?',
        difficulty: 'easy',
        tip: 'Every element is a box — margin, border, padding, content',
      },
      {
        id: 'fe-3',
        text: 'Explain how the virtual DOM works in React.',
        difficulty: 'medium',
        tip: 'Compare it to a draft before publishing the real page',
      },
      {
        id: 'fe-4',
        text: 'What is the difference between controlled and uncontrolled components in React?',
        difficulty: 'medium',
        tip: 'Think about who owns the state — React or the DOM',
      },
      {
        id: 'fe-5',
        text: 'How would you optimize a React app that renders 10,000 list items?',
        difficulty: 'hard',
        tip: 'Think virtualization, memoization, and lazy loading',
      },
    ],
  },
  {
    id: 'backend',
    label: 'Backend Developer',
    icon: '⚙️',
    questions: [
      {
        id: 'be-1',
        text: 'What is a REST API and how does it work?',
        difficulty: 'easy',
        tip: 'Focus on HTTP methods and statelessness',
      },
      {
        id: 'be-2',
        text: 'What is the difference between SQL and NoSQL databases?',
        difficulty: 'easy',
        tip: 'Think about structure, scalability, and use cases',
      },
      {
        id: 'be-3',
        text: 'Explain indexing in databases and when you would use it.',
        difficulty: 'medium',
        tip: 'Think about what a book index does — same idea',
      },
      {
        id: 'be-4',
        text: 'What is JWT and how does authentication work with it?',
        difficulty: 'medium',
        tip: 'Cover the three parts: header, payload, signature',
      },
      {
        id: 'be-5',
        text: 'How would you design a rate limiting system for a public API?',
        difficulty: 'hard',
        tip: 'Think about token bucket, sliding window algorithms',
      },
    ],
  },
  {
    id: 'general',
    label: 'General Software',
    icon: '💡',
    questions: [
      {
        id: 'gen-1',
        text: 'Tell me about yourself and your experience as a developer.',
        difficulty: 'easy',
        tip: 'Past, present, future — keep it under 2 minutes',
      },
      {
        id: 'gen-2',
        text: 'What is your biggest strength as a developer?',
        difficulty: 'easy',
        tip: 'Be specific with a real example, not a generic answer',
      },
      {
        id: 'gen-3',
        text: 'Describe a challenging bug you faced and how you solved it.',
        difficulty: 'medium',
        tip: 'Use the STAR method: Situation, Task, Action, Result',
      },
      {
        id: 'gen-4',
        text: 'How do you handle tight deadlines and pressure?',
        difficulty: 'medium',
        tip: 'Show a real example, mention communication and prioritization',
      },
      {
        id: 'gen-5',
        text: 'Where do you see yourself in 5 years?',
        difficulty: 'hard',
        tip: 'Align your growth with the growth of the company',
      },
    ],
  },
  {
    id: 'mobile',
    label: 'Mobile Developer',
    icon: '📱',
    questions: [
      {
        id: 'mob-1',
        text: 'What is the difference between React Native and native development?',
        difficulty: 'easy',
        tip: 'Cover performance, code sharing, and developer experience',
      },
      {
        id: 'mob-2',
        text: 'What is Expo and why would you use it?',
        difficulty: 'easy',
        tip: 'Focus on managed workflow and what it abstracts away',
      },
      {
        id: 'mob-3',
        text: 'How does navigation work in React Native apps?',
        difficulty: 'medium',
        tip: 'Mention React Navigation or Expo Router and the stack/tab concepts',
      },
      {
        id: 'mob-4',
        text: 'What are the performance best practices in React Native?',
        difficulty: 'medium',
        tip: 'FlatList, memo, useCallback, avoid inline styles',
      },
      {
        id: 'mob-5',
        text: 'How would you handle offline support in a React Native app?',
        difficulty: 'hard',
        tip: 'Think AsyncStorage, SQLite, background sync, and conflict resolution',
      },
    ],
  },
];

export const getRoleById = (id: string) => ROLES.find((r) => r.id === id);

export const DIFFICULTIES = [
  { label: 'Easy', value: 'easy', color: '#4CAF50' },
  { label: 'Medium', value: 'medium', color: '#FF9800' },
  { label: 'Hard', value: 'hard', color: '#F44336' },
];

export type Difficulty = 'easy' | 'medium' | 'hard';
