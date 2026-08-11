import { renderVideo } from '@revideo/renderer';
import { resolve } from 'node:path';

const file = await renderVideo({
  projectFile: './revideo/project.ts',
  settings: {
    outFile: 'knowledge-graph.mp4',
    outDir: './public/marketing',
    workers: 1,
    logProgress: true,
    projectSettings: { fps: 30, range: [0, 5], size: { x: 1280, y: 720 } },
    viteConfig: {
      resolve: { alias: { '@': resolve(process.cwd(), 'src') } },
    },
  },
});

console.log(`Revideo marketing asset written to ${file}`);
