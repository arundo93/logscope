export type AppConfig = {
  openTelemetry: {
    /** Максимальный размер тела запроса приёма (байт). По умолчанию 1 МБ. */
    maxBodyBytes: number;
    /** Максимум записей/спанов в одном батче. */
    maxLogsPerBatch: number;
    /** Максимальный размер `attributes` одной записи (байт). */
    maxAttributesBytes: number;
    /** Максимальная глубина вложенности `attributes`. */
    maxAttributesDepth: number;
  };
};
