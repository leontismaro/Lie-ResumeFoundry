export interface AdminRouteOption {
  label: string;
  value: string;
}

export const adminRouteOptions: AdminRouteOption[] = [
  {
    "label": "全量主简历（主页网页版）",
    "value": "/"
  },
  {
    "label": "全量主简历（主页打印版）",
    "value": "/print"
  },
  {
    "label": "AI 平台（网页版）",
    "value": "/resume/ai-platform"
  },
  {
    "label": "AI 平台（打印版）",
    "value": "/resume/ai-platform/print"
  },
  {
    "label": "全栈产品（网页版）",
    "value": "/resume/full-stack"
  },
  {
    "label": "全栈产品（打印版）",
    "value": "/resume/full-stack/print"
  },
  {
    "label": "简历目录页",
    "value": "/resumes"
  }
];
