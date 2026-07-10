import { execFile } from "child_process";
import path from "path";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "serato_toolkit.py");

/**
 * Runs the already-tested serato_toolkit.py (validated against a real
 * Serato crate file — see scripts/serato_toolkit.py header) as a child
 * process and parses its --json output. Using execFile (not exec/shell)
 * means args are never shell-interpreted, so user-supplied folder paths
 * can't be used for command injection.
 */
export function runSeratoToolkit(args: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    execFile(
      "python3",
      [SCRIPT_PATH, ...args, "--json"],
      { maxBuffer: 1024 * 1024 * 32 },
      (err, stdout, stderr) => {
        if (stdout && stdout.trim().length > 0) {
          try {
            const parsed = JSON.parse(stdout);
            if (parsed.error) {
              reject(new Error(parsed.error));
            } else {
              resolve(parsed);
            }
            return;
          } catch {
            // fall through to error handling below
          }
        }
        reject(new Error(err?.message || stderr || "serato_toolkit.py produced no output"));
      }
    );
  });
}
