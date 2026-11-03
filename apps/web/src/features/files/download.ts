import { fileUrl } from "./api";

/**
 * Saves a stored file to the user's device. The API is another origin, where the `download` attribute of a link is
 * ignored (the browser would navigate to it), so the bytes are fetched with the session cookie and saved from memory.
 */
export async function downloadFile(file: { id: string; name: string }) {
  const res = await fetch(fileUrl(file.id, true), { credentials: "include" });
  if (!res.ok) throw new Error(`Couldn't download "${file.name}". Try again.`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
