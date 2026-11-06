import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

// Use the full app's pure grade calculations; no environment files, database, or API clients.
for (const name of ["grades", "transcript"]) {
  const result = ts.transpileModule(readFileSync(`src/lib/${name}.ts`, "utf8"), {
    fileName: `${name}.ts`,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      rewriteRelativeImportExtensions: true,
      removeComments: true,
    },
  });
  writeFileSync(`docs/${name}.js`, result.outputText);
}
mkdirSync("docs/demo", { recursive: true });
copyFileSync("public/demo/sample-lesson.jpg", "docs/demo/sample-lesson.jpg");
console.log("Interactive Pages demo built with fictional browser-only sample data.");
