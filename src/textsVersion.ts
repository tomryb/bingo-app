import texts from "./data/texts";
import { computeTextsVersion } from "./shared/textsVersion";

export const TEXTS_VERSION = computeTextsVersion(texts);
