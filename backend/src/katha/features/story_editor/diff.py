"""Pure server-side diff calculation for canonical story snapshots."""

from dataclasses import dataclass

from katha.features.story_editor.schemas import ChangeSummary


@dataclass(frozen=True)
class PageState:
    id: int
    text_vi: str


def build_change_summary(
    *,
    title_before: str,
    title_after: str,
    pages_before: list[PageState],
    pages_after: list[PageState],
) -> ChangeSummary:
    before_by_id = {page.id: page for page in pages_before}
    after_by_id = {page.id: page for page in pages_after}
    before_ids = [page.id for page in pages_before]
    after_ids = [page.id for page in pages_after]
    edited = sorted(
        page_id
        for page_id in before_by_id.keys() & after_by_id.keys()
        if before_by_id[page_id].text_vi != after_by_id[page_id].text_vi
    )
    added = [page_id for page_id in after_ids if page_id not in before_by_id]
    deleted = [page_id for page_id in before_ids if page_id not in after_by_id]
    shared_before = [page_id for page_id in before_ids if page_id in after_by_id]
    shared_after = [page_id for page_id in after_ids if page_id in before_by_id]
    title_changed = title_before != title_after
    order_changed = shared_before != shared_after
    has_changes = bool(title_changed or edited or added or deleted or order_changed)
    return ChangeSummary(
        has_changes=has_changes,
        title_changed=title_changed,
        edited_page_ids=edited,
        added_page_ids=added,
        deleted_page_ids=deleted,
        order_changed=order_changed,
        before_count=len(pages_before),
        after_count=len(pages_after),
    )
