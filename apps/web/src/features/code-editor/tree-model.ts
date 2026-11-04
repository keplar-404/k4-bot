import type { TreeEntry } from "./api";

export type TreeNode = {
  name: string;
  path: string;
  dir: boolean;
  children: TreeNode[];
};

/** The flat listing (paths relative to the sandbox home) as a tree: folders first, then files, each alphabetically. */
export function buildTree(entries: TreeEntry[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", dir: true, children: [] };
  for (const e of entries) {
    let at = root;
    const parts = e.path.split("/");
    parts.forEach((name, i) => {
      const path = parts.slice(0, i + 1).join("/");
      let next = at.children.find((c) => c.name === name);
      if (!next) {
        next = { name, path, dir: i < parts.length - 1 || e.dir, children: [] };
        at.children.push(next);
      }
      at = next;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort(
      (a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name),
    );
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
}
