const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src/app/api').concat(['./src/lib/auth.ts']);

files.forEach(f => {
  if (!f.endsWith('.ts')) return;
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes('new PrismaClient()')) {
    content = content.replace(/import\s+\{\s*PrismaClient\s*\}\s+from\s+['"]@prisma\/client['"];?/g, '');
    content = content.replace(/const\s+prisma\s*=\s*new\s*PrismaClient\(\)?;?/g, 'import { prisma } from "@/lib/prisma";');
    fs.writeFileSync(f, content);
    console.log('Updated ' + f);
  }
});
