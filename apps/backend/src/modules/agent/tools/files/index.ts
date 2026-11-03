import { createComputerFileTools } from "./computer";
import { createGenerateImage } from "./generate-image";
import type { FileToolsOptions } from "./options";
import { createViewImage } from "./view-image";

export { MAX_VIEW_BYTES, MAX_VIEW_IMAGES, toDataUrl, type FileToolsOptions, type ViewHolder } from "./options";

/** Image creation always; view_image for vision models; copy/share only with the computer. */
export function createFileTools(o: FileToolsOptions) {
  return [
    createGenerateImage(o),
    ...(o.vision ? [createViewImage(o)] : []),
    ...(o.computer ? createComputerFileTools(o, o.computer) : []),
  ];
}
