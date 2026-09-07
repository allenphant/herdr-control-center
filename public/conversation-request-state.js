export class ConversationRequestState {
  constructor() {
    this.searchRequestId = 0;
    this.contextRequestId = 0;
    this.loading = false;
    this.contextLoading = false;
    this.hits = [];
    this.nextCursor = null;
    this.revision = null;
    this.activeAnchor = null;
    this.context = [];
    this.error = null;
  }

  beginSearch({ replace = false } = {}) {
    if (replace) this.cancelContext();
    this.searchRequestId += 1;
    this.loading = true;
    return this.searchRequestId;
  }

  finishSearch(requestId) {
    if (requestId !== this.searchRequestId) return false;
    this.loading = false;
    return true;
  }

  beginContext() {
    this.contextRequestId += 1;
    this.contextLoading = true;
    return this.contextRequestId;
  }

  finishContext(requestId) {
    if (requestId !== this.contextRequestId) return false;
    this.contextLoading = false;
    return true;
  }

  cancelContext() {
    this.contextRequestId += 1;
    this.contextLoading = false;
  }

  cancelAll() {
    this.searchRequestId += 1;
    this.loading = false;
    this.cancelContext();
  }
}
