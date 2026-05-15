import { TextDecoder, TextEncoder } from "node:util";
import { ReadableStream } from "node:stream/web";
import "@testing-library/jest-dom";

// react-router v7 uses Web APIs that jsdom doesn't provide
Object.assign(globalThis, { TextDecoder, TextEncoder, ReadableStream });
