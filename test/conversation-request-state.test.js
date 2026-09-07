import assert from "node:assert/strict";
import test from "node:test";
import { ConversationRequestState } from "../public/conversation-request-state.js";

test("a replacement search cancels an in-flight context request", () => {
  const state = new ConversationRequestState();
  const contextRequest = state.beginContext();
  const searchRequest = state.beginSearch({ replace: true });

  assert.equal(state.contextLoading, false);
  assert.equal(state.loading, true);
  assert.equal(state.finishContext(contextRequest), false);
  assert.equal(state.finishSearch(searchRequest), true);
  assert.equal(state.loading, false);
});

test("append search and context requests finish independently", () => {
  for (const completionOrder of ["search-first", "context-first"]) {
    const state = new ConversationRequestState();
    const searchRequest = state.beginSearch({ replace: false });
    const contextRequest = state.beginContext();

    if (completionOrder === "search-first") {
      assert.equal(state.finishSearch(searchRequest), true);
      assert.equal(state.loading, false);
      assert.equal(state.contextLoading, true);
      assert.equal(state.finishContext(contextRequest), true);
    } else {
      assert.equal(state.finishContext(contextRequest), true);
      assert.equal(state.contextLoading, false);
      assert.equal(state.loading, true);
      assert.equal(state.finishSearch(searchRequest), true);
    }
    assert.equal(state.loading, false);
    assert.equal(state.contextLoading, false);
  }
});
