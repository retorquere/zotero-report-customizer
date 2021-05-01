export interface ReportConfig {
  items: {
    sort: string;
  };
  fields: {
    remove: string[];
    order: string[];
  };
}
