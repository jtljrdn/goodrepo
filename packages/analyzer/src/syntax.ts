import ts from "typescript"

export function sourceFacts(source: string, path = "file.tsx") {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const imports = new Set<string>()
  let readsEnv = false
  let client = false
  function visit(node: ts.Node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      imports.add(node.moduleSpecifier.text)
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      const arg = node.arguments[0]
      if (arg && ts.isStringLiteralLike(arg)) imports.add(arg.text)
    }
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    ) {
      const name = ts.isPropertyAccessExpression(node)
        ? node.name.text
        : node.argumentExpression &&
            ts.isStringLiteralLike(node.argumentExpression)
          ? node.argumentExpression.text
          : ""
      if (
        name === "env" &&
        /^(process|Bun|Deno|import\.meta)$/.test(node.expression.getText(file))
      )
        readsEnv = true
    }
    ts.forEachChild(node, visit)
  }
  for (const statement of file.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    )
      break
    if (statement.expression.text === "use client") client = true
  }
  visit(file)
  return { imports: [...imports], readsEnv, client }
}
