// 고유 id 생성. crypto.randomUUID는 모든 최신 브라우저(보안 컨텍스트)에서 지원.
export function newId(): string {
  return crypto.randomUUID();
}
