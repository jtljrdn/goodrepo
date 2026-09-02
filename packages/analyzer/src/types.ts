export type SignalId =
  | "readme"
  | "readmeDepth"
  | "predictableRoot"
  | "shallowTree"
  | "colocatedTests"
  | "generatedExcluded"
  | "agentsMd"
  | "claudeMd"
  | "docPackageManager"
  | "docTestCommand"
  | "docBuildCommand"
  | "docArchitecture"
  | "docDatabase"
  | "docApiConventions"
  | "docCodeStyle"
  | "testScript"
  | "testConfig"
  | "testsExist"
  | "typecheckScript"
  | "singleTestDocumented"
  | "ciRunsTests"
  | "coverage"
  | "singleValidationLib"
  | "consistentRouteShape"
  | "consistentNaming"
  | "singleDataLayer"
  | "consistentErrors"
  | "lintConfig"
  | "lockfile"
  | "lintScript"
  | "formatScript"
  | "buildScript"
  | "envExample"
  | "container"
  | "ciWorkflow"
  | "nodePinned"
  | "smallFiles"
  | "noMegaFiles"
  | "featureFolders"
  | "lowFanout"

export type Measurement = { value: number; threshold: number; unit: string }

export type TreeEntry = {
  path: string
  bytes: number
}

export type RepoMeta = {
  owner: string
  repo: string
  description: string
  stars: number
  defaultBranch: string
  commitSha: string
  commitMessage: string
}

export type TruncationCap = "tree"

export type CodeFileFacts = {
  path: string
  bytes: number
  imports: string[] | null
  readsEnv?: boolean
}

export type SampleInfo = { sampled: number; total: number }

export type RawFacts = {
  paths: string[]
  codeFiles: CodeFileFacts[]
  keptText: Map<string, string>
  sample: SampleInfo | null
  truncated: null | { cap: TruncationCap; detail: string }
}

export type RepoProfile = RepoMeta & {
  framework: string
  language: string
  files: number
  directories: number
  maxDirectoryDepth: number
  totalBytes: number
  medianFileBytes: number
  largestFileBytes: number
  packageManager: string | null
  scripts: Record<string, string>
  testFramework: string | null
  testFiles: number
  apiRoutes: number
  validationPatterns: string[]
  docs: { readmeWords: number; agentsMdWords: number; sections: string[] }
  has: Record<SignalId, boolean | null>
  measurements: Partial<Record<SignalId, Measurement>>
  sample: SampleInfo | null
  truncated: null | { cap: TruncationCap; detail: string }
}
