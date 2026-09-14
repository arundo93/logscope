import type { AppConfig } from "./types";

export const config: AppConfig = {
	openTelemetry: {
		maxBodyBytes: 1048576,
		maxLogsPerBatch: 200,
		maxAttributesBytes: 65536,
		maxAttributesDepth: 8,
	},
};
