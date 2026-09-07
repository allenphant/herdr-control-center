---
name: "Pane Relay"
description: "A switchboard dispatch ledger for returning a message to one verified Herdr conversation."
colors:
  mineral-paper: "#edf0eb"
  ledger-surface: "#f8f9f5"
  ledger-raised: "#fdfdfa"
  ledger-muted: "#e5e9e3"
  mineral-ink: "#18211f"
  ink-soft: "#52605c"
  ink-faint: "#505c58"
  rule: "#cfd6cf"
  rule-strong: "#aeb9b2"
  routing-green: "#0c675d"
  routing-green-hover: "#07574f"
  routing-green-soft: "#d6ebe5"
  action-green: "#07574f"
  action-green-hover: "#04463f"
  on-action: "#f4fbf8"
  warning: "#9a541f"
  warning-soft: "#f4e4d6"
  quota-surface: "#fff1e3"
  quota-raised: "#fff9f2"
  quota-accent: "#bd5f18"
  quota-ink: "#3d2415"
  danger: "#963b35"
  danger-soft: "#f4ddda"
  success: "#246547"
  success-soft: "#dcebe1"
  focus: "#167f74"
  mineral-night: "#131816"
  night-surface: "#1a211e"
  night-raised: "#202825"
  night-muted: "#252e2a"
  night-ink: "#edf3ef"
  night-ink-soft: "#b5c1bb"
  night-ink-faint: "#8c9993"
  night-rule: "#36423d"
  night-rule-strong: "#506059"
  night-routing-green: "#71c6b8"
  night-routing-green-hover: "#8ed7ca"
  night-routing-green-soft: "#203e37"
  night-action-green: "#276f65"
  night-action-green-hover: "#2f7e73"
  night-warning: "#e6a56f"
  night-warning-soft: "#493526"
  night-quota-surface: "#302117"
  night-quota-raised: "#3c291d"
  night-quota-accent: "#f0a061"
  night-quota-ink: "#fff4e8"
  night-danger: "#ef9a91"
  night-danger-soft: "#4a2927"
  night-success: "#8bc9a5"
  night-success-soft: "#254134"
  night-focus: "#89d8cb"
typography:
  title:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 760
    lineHeight: 1.5
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 720
    lineHeight: 1.5
    letterSpacing: "-0.015em"
  body:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.76rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "normal"
  identifier:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.72rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  status: "7px"
  compact: "8px"
  control: "10px"
  route: "11px"
  mark: "12px"
  record: "13px"
  summary: "14px"
  panel: "16px"
spacing:
  xxs: "3px"
  xs: "6px"
  sm: "8px"
  control: "10px"
  md: "12px"
  lg: "18px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.action-green}"
    textColor: "{colors.on-action}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.action-green-hover}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.control}"
  button-quiet:
    backgroundColor: "{colors.ledger-raised}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
    height: "38px"
  field:
    backgroundColor: "{colors.ledger-raised}"
    textColor: "{colors.mineral-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
    height: "42px"
  route-selected:
    backgroundColor: "{colors.routing-green-soft}"
    textColor: "{colors.mineral-ink}"
    rounded: "{rounded.route}"
    padding: "11px 12px 11px 16px"
  status-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.status}"
    padding: "3px 7px"
    height: "22px"
  record:
    backgroundColor: "{colors.ledger-raised}"
    textColor: "{colors.mineral-ink}"
    rounded: "{rounded.record}"
    padding: "14px"
---

# Design System: Pane Relay

> Languages: 繁體中文說明 first, followed by the English design specification. Machine-readable tokens remain language-neutral.

## 中文說明

本文件前半的 YAML token、元件規格與英文設計說明是實作參考；以下提供同一套設計決策的繁體中文版本。顏色 token、尺寸、CSS 變數與機器識別名稱維持原文，避免實作時產生歧義。

### 設計核心：Switchboard Dispatch Ledger

Pane Relay 應像安靜而精準的交換台帳：使用者選定一條路由、驗證一個 conversation fingerprint，然後允許一筆投遞紀錄繼續執行。明亮的礦物紙與深色礦物夜表面讓工作區保持平靜；深綠色 routing signal 只標示即時且已驗證的路徑。

元件風格要克制、明確、可操作。階層來自規則線、方正的 routing rail、表格式識別文字與緊湊的狀態標籤，而不是裝飾性的 dashboard card。pane rail、composer 與 queue 必須讀起來像同一個連續的投遞系統，每個重要狀態都要同時用文字與顏色表達。

### 色彩

- 明亮與深色主題都使用低彩度礦物背景。
- Deep Routing Green 只用於選定 pane、focus、working state、已驗證路徑與主要投遞動作。
- Action Green 專門承載 composer 的主要排程動作，比 routing accent 更深。
- Resolved Green 表示 idle、done、sent、online；Deferred Ochre 表示 waiting、blocked、paused、connecting；Refusal Red 表示 failed、canceled、連線錯誤與破壞性操作。
- 所有 success、warning、danger 顏色都必須搭配可讀的狀態文字與穩定形狀，不能只靠顏色傳達意思。

### 字體與識別文字

標題與內文使用系統 UI sans serif；pane ID、fingerprint、session name、時區與 timestamp 使用 UI monospace，並在需要對齊的數值使用 tabular numerals。Monospace 只代表實際的機器識別或時間資料，不作為終端機風格裝飾。

### 布局

桌面版是連續的三欄 ledger：左側 live conversation index、中央較寬的 composer、右側 queue。展開 workspace 時，優先依 Herdr 真實 rectangle 顯示比例 pane map；清單模式是明確的替代方案，也是密集或不一致布局的安全 fallback。三欄以一像素 seam 連在同一個 rounded shell 裡。

在較窄寬度，queue 移到 route/composer 下方；手機版改成單欄 ledger，解除內部滾動，收合 identity/time grid，並把 composer action 固定在 viewport 底部。空間必須緊湊且重複，避免不必要的裝飾性留白。

### 深度、形狀與選取

主要 shell 使用唯一的 ambient shadow；fields、summaries、records 與 routing choices 維持扁平，主要靠 surface tone、規則線與 inset rail 建立層次。整體輪廓採柔和方角：shell 最大 16px、controls 10px、records 11–14px、status chip 7px。

垂直綠色 rail 代表精確的 selected 或 verified route，不能當成一般裝飾。pane option 使用 2px rail，verified target summary 使用 4px rail；空的 target 才使用刻意的虛線框。

### 元件

- **Buttons**：一般 controls 最低 38px，觸控密度較高的 queue/job actions 最低 44px；主要排程 action 全寬、最低 46px。鍵盤 focus 必須有清楚的三像素半透明 outline。
- **Chips**：狀態 chip 使用緊湊圓角、語意顏色與明確文字；快速時間按鈕使用 raised surface 與 border。
- **Cards / Containers**：pane routes、verified target、queue records 與 quota overlay 都以表面色、規則線與 routing rail 建立層次，不使用大量陰影。
- **Inputs / Fields**：使用 raised surface、明確 border、10px 圓角與至少 42px 高度；textarea 至少 138px，focus 時 border 轉為 Routing Green。
- **Navigation**：workspace 是可收合、帶 sticky heading 的 ruled group；pane 可使用真實幾何或清單模式。附件要有原生 file picker、縮圖、類型/大小限制與移除操作，queue 只顯示附件摘要，不暴露本機路徑。
- **Dispatch Composer**：依序呈現 verified target、訊息、日期/週期、快速時間、投遞策略、等待上限、安全提示與固定在底部的主要 action。
- **Service feedback**：服務狀態使用語意 dot、ring 與文字；toast 使用 raised surface、strong rule 與錯誤色 border。

### 應做與避免

應讓 pane 選取、fingerprint 驗證、排程建立與 queue resolution 保持視覺連續；以最近終端內容協助辨識重複標題；只在 verified routing、active state、focus 與主要投遞 action 使用深綠色；每個語意色都配上狀態文字；寬螢幕保留三欄，手機保留底部主要 action。

避免依 Agent 顯示名稱而非 pane/fingerprint 路由；避免裝飾性 dashboard cards、promotional metrics、gradients 與 marketing claims；避免把 monospace 當成終端機裝飾；避免沒有真實狀態意義的綠 rail、語意色與 danger color；避免在 records、fields、policy options 到處添加浮動陰影，也不要把主要排程 action 藏離 composer 底部。

## English
## Overview

**Creative North Star: "The Switchboard Dispatch Ledger"**

Pane Relay feels like a quiet, exacting switchboard ledger: a working surface where one route is selected, one conversation fingerprint is verified, and one dispatch record is allowed to proceed. Mineral paper and mineral night surfaces keep the interface calm while deep routing green marks the live signal path.

The component philosophy is restrained, explicit, and operational. Structure comes from ruled boundaries, squared routing rails, tabular identifiers, and compact state labels rather than decorative dashboard cards. Information density is purposeful: the pane rail, composer, and queue remain legible as one connected dispatch system, and every consequential state is written as text as well as color.

**Key Characteristics:**

- Quiet mineral surfaces in coordinated light and dark themes.
- Deep green signal ink reserved for routing, focus, selected state, and the primary dispatch action.
- Ruled, ledger-like panels with tabular monospace identifiers.
- Restrained semantic success, warning, and danger states that always retain explicit text.
- Tonal and structural elevation with a single ambient shell shadow.

## Colors

The palette is a low-chroma mineral field with one deep routing-green voice and restrained semantic inks; the paired night tokens preserve the same role hierarchy in dark mode.

### Primary

- **Deep Routing Green** (`routing-green`): marks the selected pane rail, working state, caret, selection, and other verified signal paths.
- **Action Green** (`action-green`): carries the full-width schedule action and is intentionally deeper than the routing accent.
- **Routing Mist** (`routing-green-soft`): provides selected and active tonal fill without turning the interface into a collection of cards.

### Secondary

- **Resolved Green** (`success` / `success-soft`): identifies idle, done, sent, and online outcomes.
- **Deferred Ochre** (`warning` / `warning-soft`): identifies waiting, blocked, paused, and connecting states.
- **Refusal Red** (`danger` / `danger-soft`): identifies failed, canceled, connection-error, and destructive states.

### Neutral

- **Mineral Paper** (`mineral-paper`): the light-mode application field and ruled page ground.
- **Ledger Surface** (`ledger-surface`): the main panel plane.
- **Raised Ledger** (`ledger-raised`): fields, records, tabs, and local summaries.
- **Muted Mineral** (`ledger-muted`): subtle controls, chips, and structural tonal separation.
- **Mineral Ink** (`mineral-ink`): primary text; `ink-soft` and `ink-faint` step down supporting copy and metadata.
- **Ledger Rules** (`rule` / `rule-strong`): panel seams, field strokes, and more emphatic control boundaries.
- **Mineral Night Family** (`mineral-night`, `night-surface`, `night-raised`, `night-muted`, and paired night inks/rules): dark-mode replacements, not an alternate visual identity.

**The Signal Ink Rule.** Deep routing green is reserved for a verified path, focus, an active state, or the primary dispatch action; it is never ambient decoration.

**The State Redundancy Rule.** Success, warning, and danger always combine semantic color with readable status text and a stable shape.

## Typography

**Display Font:** System UI sans serif
**Body Font:** System UI sans serif
**Label/Mono Font:** UI monospace for identifiers and time values

**Character:** The system sans is compact, neutral, and operational. Monospace appears only where exact identity matters—pane IDs, fingerprints, session names, time zones, and timestamps—and uses tabular numerals where values must align.

### Hierarchy

- **Title** (760, `title`): the Pane Relay lockup; compact rather than promotional.
- **Heading** (720, `heading`): panel and section headings that anchor scan paths across the ledger.
- **Body** (400, `body`): form copy, messages, safety guidance, and dispatch content.
- **Label** (700, `label`): field names, legends, compact actions, and state-supporting metadata.
- **Identifier** (400, `identifier`): pane IDs, fingerprints, Herdr sessions, paths, dates, and time zones.

**The Identifier Integrity Rule.** Use monospace only for literal machine identity or time data; never use it as a decorative terminal effect.

## Layout

The desktop shell is a connected three-column ledger: a live conversation index at left (`minmax(360px, 1.12fr)`), a wider center composer (`minmax(500px, 1.45fr)`), and a right queue (`minmax(320px, 0.95fr)`). Expanded workspace tabs lead with a proportional pane map derived from Herdr's real rectangles; the linear list remains an explicit alternative and an automatic safety fallback. One-pixel seams join the columns inside the rounded shell, while page margins scale from 18px to 44px.

At 1180px the queue moves below the route/composer pair and records form a two-column grid. At 760px the shell becomes a single vertical ledger, internal scrolling is released to the page, the identity and time grids collapse, and the composer action bar sticks to the bottom. At 440px panel headings stack and compact actions keep a minimum 44px touch height. Mobile starts from the active work area and preserves the composer action at the viewport foot.

Spacing is compact and repeated rather than ornamental: 1px structural seams; tight 3–12px control gaps; 18px panel-heading and record rhythm; and 28px center-composer insets on desktop, reduced to 16px on mobile.

**The Connected Ledger Rule.** Route rail, composer, and queue read as one ruled instrument; do not separate them into floating dashboard cards.

## Elevation & Depth

Elevation is mostly tonal and structural. The connected app shell receives the one ambient shadow that separates the working ledger from the mineral page; dark mode deepens that same shadow. Fields, summaries, records, and routing choices remain flat and gain hierarchy through surface tone, rules, and inset rails. Small local shadows appear only on the brand mark, selected queue tab, primary action glow, sticky composer edge, and toast feedback.

### Shadow Vocabulary

- **Ambient shell** (`0 20px 60px rgb(31 45 40 / 0.09)`; dark: `0 24px 72px rgb(0 0 0 / 0.28)`): the sole persistent environmental lift.
- **Brand mark** (`0 8px 24px rgb(31 45 40 / 0.08)`): a restrained lockup accent.
- **Primary signal glow** (`0 9px 24px color-mix(in srgb, var(--accent) 22%, transparent)`): reinforces the schedule action without making it float.
- **Selected tab** (`0 2px 8px rgb(31 45 40 / 0.08)`): distinguishes the pressed queue filter inside its tonal track.
- **Sticky action edge** (`0 -10px 24px color-mix(in srgb, var(--surface) 88%, transparent)`): keeps the composer action legible over scrolling content.

**The Flat Record Rule.** Records and field groups stay flat at rest; use rules and tonal shifts before adding shadow.

## Shapes

The silhouette is softly squared: the connected shell uses the largest 16px corner, while controls use a consistent 10px radius and records range from 11px to 14px according to scale. Status labels use tighter 7px corners. Selection is not communicated by curvature alone: pane options carry a 2px routing rail, and the verified target summary carries a 4px routing rail. Borders remain one pixel and solid except for the intentionally dashed empty target.

**The Routing Rail Rule.** A vertical green rail means an exact selected or verified route; never reuse it as a generic ornament.

## Components

Components are restrained, explicit, and operational. Every interactive state remains recognizable through a combination of fill, stroke, text, rail, or pressed position.

### Buttons

- **Shape:** Softly squared controls use the shared 10px control radius and 38px minimum height; compact queue/job actions rise to 44px where touch density requires it.
- **Primary:** The schedule action spans the composer width, uses Action Green with light text, and reaches 46px minimum height.
- **Hover / Focus:** Hover deepens the green or strengthens the neutral rule; keyboard focus uses a visible three-pixel translucent focus outline with a two-pixel offset. Pressing translates a standard button down one pixel.
- **Quiet / Job actions:** Raised Ledger fill, neutral ink, and a ledger-rule border keep utility actions subordinate. Destructive job actions use Refusal Red text without becoming a second primary button.

### Chips

- **Status labels:** Compact 7px chips pair lowercase or localized state text with semantic ink and a soft tonal background.
- **Quick time actions:** Small bordered controls use Raised Ledger fill and strengthen their border and text on hover.

### Cards / Containers

- **Pane routes:** Borderless at rest, a subtle rule and muted fill on hover, and Routing Mist plus a deep green rail when selected.
- **Verified target summary:** Raised Ledger fill, a standard rule, a 14px corner, and a four-pixel routing rail that binds the visible identity grid to the composer.
- **Queue records:** Raised Ledger fill, a one-pixel rule, a 13px corner, and 14px internal padding. No resting shadow.
- **Quota overlay:** A dedicated warm ochre surface distinguishes account limits from the routing ledger. A dark translucent backdrop blurs the working surface while the panel is open; the draggable quota orb uses the same orange accent in both themes.
- **Policy options:** Raised Ledger fill and a one-pixel rule; the checked option shifts to Routing Mist and a mixed green border.

### Inputs / Fields

- **Style:** Raised Ledger fill, Mineral Ink text, a strong ledger rule, a 10px corner, and a 42px minimum height. Textareas use a 138px minimum height and remain vertically resizable.
- **Focus:** Hover and focus move the border to Routing Green; keyboard focus retains the global focus outline.
- **Disabled:** Controls lower opacity to 0.58 and use a not-allowed cursor while preserving readable labels.

### Navigation

- **Pane navigation:** Workspaces are collapsible, sticky-headed ruled groups. Each tab can render its true pane geometry, with tiles ordered top-to-bottom and left-to-right for keyboard traversal. A separate dashed inner outline identifies Herdr focus; the solid routing selection remains independent. The list alternative leads with title and state, recent terminal content, then pane, tab, agent, and path identity.
- **Attachments:** The composer uses a native file picker, restrained thumbnail rows, explicit type/size limits, and removable pending files. Queue records summarize persisted attachments without exposing their local paths.
- **Queue tabs:** A two-segment pressed control sits on Muted Mineral; the active segment uses Raised Ledger, primary ink, and a small structural shadow.
- **Responsive treatment:** The navigation and queue become vertical ledger sections rather than drawers or hidden menus.

### Dispatch Composer

The composer combines the verified target summary, message field, date/recurrence row, quick time controls, dispatch-policy choices, wait limit, safety note, and a sticky full-width action. The action belongs at the composer's foot so the verification context remains upstream of commitment.

### Service and Event Feedback

The service state uses a small semantic dot with a soft ring plus explicit text. Toasts use the raised surface, strong rule, ambient shell shadow, and a danger-tinted border for errors. The event ledger expands beneath the main shell and keeps status, message, and tabular timestamp on one ruled row when space permits.

## Do's and Don'ts

### Do:

- **Do** keep pane selection, fingerprint verification, schedule composition, and queue resolution visually connected as one dispatch ledger.
- **Do** use ephemeral recent-output previews as the primary recognition clue when pane titles or paths repeat.
- **Do** use tabular monospace for pane IDs, fingerprints, sessions, time zones, and timestamps.
- **Do** reserve deep green for verified routing, active state, focus, and the primary dispatch action.
- **Do** pair every semantic color with explicit status or error text.
- **Do** preserve the three-column first viewport on wide screens and the sticky composer action on mobile.
- **Do** express hierarchy with mineral surface tones, one-pixel rules, and routing rails before shadow.

### Don't:

- **Don't** route or visually group work by agent display name when the pane and conversation fingerprint are the verified identity.
- **Don't** introduce decorative dashboard cards, promotional metrics, gradients, or marketing claims.
- **Don't** use monospace as a terminal-themed decoration outside literal identifiers and time data.
- **Don't** use green rails, semantic fills, or danger color without a real state meaning.
- **Don't** scatter floating shadows across records, fields, or policy options.
- **Don't** hide the primary schedule action above or away from the composer's foot.
