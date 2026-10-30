import { readFileSync, writeFileSync } from "node:fs";
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
console.log("Read-only Pages demo built with fictional sample data.");
