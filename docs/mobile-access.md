# 手機與跨裝置操作 Herdr 指南

> 本文件是 [Herdr Control Center](../README.md) 的遠端存取指南。若要在瀏覽器中選定特定 pane、核對原對話並排程續作，請參閱 [Pane Relay 文件](pane-relay.md)。

> **Mobile Herdr AI Agent Workflow & Remote Access Guide**
> 本指南說明如何透過手機（Android / iOS）或跨裝置在 4G/5G、跨國外網環境下，安全、流暢地連線並操控 Linux 電腦上的 `herdr` 終端工作區，即時指揮多個 AI Coding Agent（Claude Code、Codex、AGY 等），以及網頁服務轉發、跨裝置連線與多用戶遠端協作教學。

---

## 📑 目錄
1. [系統架構概觀](#1-系統架構概觀)
2. [先決條件與必備軟體](#2-先決條件與必備軟體)
3. [電腦端設定（Host Linux）](#3-電腦端設定host-linux)
4. [手機端連線設定（Tailscale + Termius）](#4-手機端連線設定tailscale--termius)
5. [Termius 行動體驗調優（中文/語音/按鍵）](#5-termius-行動體驗調優中文語音按鍵)
6. [日常實戰操作流程（Cheatsheet）](#6-日常實戰操作流程cheatsheet)
7. [進階功能 1：跨國出差與全球連線原理](#7-進階功能-1跨國出差與全球連線原理)
8. [進階功能 2：手機瀏覽本機網頁服務（如 127.0.0.1:4317）](#8-進階功能-2手機瀏覽本機網頁服務如-1270014317)
9. [進階功能 3：Apple 裝置（iPhone/iPad）與家裡電腦連線指南](#9-進階功能-3apple-裝置iphoneipad與家裡電腦連線指南)
10. [進階功能 4：如何教另一位夥伴/同事連線（多人協作）](#10-進階功能-4如何教另一位夥伴同事連線多人協作)
11. [常見問題與故障排除（FAQ）](#11-常見問題與故障排除faq)

---

## 1. 系統架構概觀

```text
┌─────────────────────────────────────────────────────────────┐
│                 客戶端裝置 (Mobile / PC / Mac)               │
│                                                             │
│   [ Termius / Terminal ] <───> [ Tailscale VPN ] (智慧分流) │
│    • CJK 繁中/語音輸入            • 點對點加密 Mesh (全球 DERP)  │
│    • F9 一鍵 Zoom                • 支援跨國穿透防火牆          │
│    • 網頁 Port 轉發 / 檔案上傳                                │
└──────────────────────────────┬──────────────────────────────┘
                               │ (WireGuard 加密通道)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Linux 主機 (Host PC)                      │
│                                                             │
│   [ OpenSSH Server ] (:22)                                  │
│          │                                                  │
│   [ herdr (Server & Persistent Session) ]                   │
│          ├── Pane 1: Claude Code (寫程式)                    │
│          ├── Pane 2: Codex (程式碼審查)                      │
│          ├── Pane 3: AGY / Terminal (自動化測試)             │
│          └── 本機 Web 服務 (例如 http://127.0.0.1:4317)     │
└─────────────────────────────────────────────────────────────┘
```

* **安全零暴露**：不需在路由器開 Port Forwarding，無公網 IP 外洩風險。
* **智慧分流（Split Tunneling）**：手機連線時，一般上網（LINE、YouTube）不受影響，只有內部連線走 Tailscale。
* **狀態永續（Persistent Session）**：手機連線中斷或關閉 App，電腦上的 AI Agent 依然持續在背景運作。

---

## 2. 先決條件與必備軟體

| 裝置 | 必要軟體 | 用途說明 |
| :--- | :--- | :--- |
| **Linux 電腦** | `OpenSSH Server` | 提供遠端 SSH 連線通道 |
| | `Tailscale` | 建立跨網段私有虛擬內網（Mesh VPN） |
| | `herdr` | AI Agent 終端多工作區管理核心 |
| **智慧型手機** | `Tailscale App` | 連入私有虛擬網路 |
| (Android / iOS) | `Termius App` | 專業行動 SSH 終端機客戶端 |
| **家裡電腦** | `Tailscale` + 內建終端機 | 跨平台遠端開發 |

---

## 3. 電腦端設定（Host Linux）

### 3.1 確認 SSH 服務已啟動
```bash
# 啟動並設定開機自啟 SSH
sudo systemctl enable --now ssh

# 確認 Port 22 正常監聽中
ss -tulpn | grep 22
```

### 3.2 查詢您的連線資訊（IP、帳號、主機名稱）
在 Linux 電腦終端機執行以下指令，獲取您的連線參數：

```bash
# 1. 啟動 Tailscale（若尚未登入，請依提示點擊網址完成登入）
sudo tailscale up

# 2. 查詢您電腦專屬的 Tailscale IP（以 100. 開頭）
tailscale ip -4

# 3. 查詢您當前 Linux 使用者帳號
whoami

# 4. 查詢您電腦的主機名稱
hostname
```

> 💡 **範例說明**：
> * `tailscale ip -4` 輸出的 IP（例如 `100.x.y.z`），後續文件中簡稱為 `<YOUR_TAILSCALE_IP>`。
> * `whoami` 輸出的帳號名稱（例如 `ubuntu` 或 `your_name`），簡稱為 `<YOUR_USERNAME>`。
> * `hostname` 輸出的設備名稱（例如 `my-dev-pc`），簡稱為 `<YOUR_HOSTNAME>`。

### 3.3 在 herdr 設定自訂單鍵快捷鍵（將 Zoom 綁定為 F9）
herdr 預設的放大視窗快捷鍵為 `prefix + z`（需先按 `Ctrl+b` 再按 `z`），在手機虛擬鍵盤上操作較繁瑣。

**核心技巧**：在 herdr 設定檔中將 Zoom 直接綁定為單鍵 **`F9`**，手機端 Termius 只要點一下虛擬按鍵列的 `F9` 就能秒放大視窗！

編輯 `~/.config/herdr/config.toml`：
```toml
onboarding = false

[session]
resume_agents_on_restore = true

[keys]
# 自訂單鍵 F9 取代預設 prefix+z，實現單鍵快速切換 Pane 全螢幕放大／還原
zoom = "f9"

[ui]
agent_panel_sort = "priority"
```
存檔後於終端機執行 `herdr server reload-config` 套用設定。

---

## 4. 手機端連線設定（Tailscale + Termius）

### 4.1 手機安裝與登入 Tailscale
1. 下載並打開 **Tailscale**。
2. **重要關鍵**：登入時必須選擇與電腦端**完全相同**的帳號/組織（例如相同的 Google、Microsoft 或 GitHub 帳號）。
3. 打開 Tailscale 連線開關（狀態變為綠色 `Connected`）。
4. 在 Devices 列表確認能看見您的 Linux 主機名稱（`<YOUR_HOSTNAME>`）顯示為線上 🟢。

### 4.2 設定 Android 背景防休眠（三星/各家 Android 必做）
為防手機螢幕暗掉時 Tailscale 被系統休眠導致斷線：
* 進入手機 **「設定」➔「應用程式」➔ 找到「Tailscale」➔「電池」➔ 選擇「不受限制（Unrestricted）」**。

### 4.3 在 Termius 新增 Host 連線
1. 打開 **Termius** App，點擊 **「+」➔「New Host」**。
2. 填寫連線參數：
   * **Label / Alias**：`My-Linux`（自訂好記名稱）
   * **Hostname / IP**：填入剛才查到的 `<YOUR_TAILSCALE_IP>`（例如 `100.x.y.z`）
   * **Port**：`22`
   * **Username**：您的 Linux 使用者帳號（`<YOUR_USERNAME>`）
   * **Password**：您的 Linux 登入密碼
3. 點擊右上角 **「Save」** 儲存。

---

## 5. Termius 行動體驗調優（中文/語音/按鍵）

### 5.1 開啟繁體中文（CJK）與語音輸入支援
1. 打開 Termius ➔ 進入 **Settings（設定）➔ Terminal**。
2. 開啟 **CJK Support（中日韓字元支援）** 與 **Voice Input（語音輸入）**。
3. 確認 **Character Encoding** 為 **`UTF-8`**。

### 5.2 善用輔助按鍵列（Extra Keys Bar）
在 Termius 連線畫面中，鍵盤上方會出現一排功能按鈕：
* **點擊 `F9`**：Termius 送出 `F9` 按鍵訊號，觸發電腦端 herdr 的 Zoom 功能，瞬間將當前選取的 Pane 放大至全螢幕（再次按 `F9` 還原多分割視窗）。
* **點擊 `📋 Paste` 按鈕**：一鍵貼上剪貼簿內容，不漏字、不吃字。
* **點擊 `Ctrl` + `b` 組合鍵**：呼叫 herdr 系統前綴指令（例如 `Ctrl+b` 放開按 `v` 左右開新視窗）。

### 5.3 圖片上傳給 Agent 分析
1. 點擊 Termius 內建的 **「檔案上傳 / SFTP」** 按鈕。
2. 從手機相簿選取截圖上傳至電腦目錄（例如 `screenshot.png`）。
3. 在終端機對 Agent 說：`請看 screenshot.png，幫我分析畫面上的問題`。

---

## 6. 日常實戰操作流程（Cheatsheet）

| 情境 / 動作 | 操作步驟 | 備註說明 |
| :--- | :--- | :--- |
| **連線並進入工作區** | 點擊 Termius 連線 ➔ 輸入 `herdr` | 自動接軌電腦端所有 Pane |
| **放大單一 Agent 視窗** | 點一下該 Pane ➔ 按按鍵列的 **`F9`** | 解決手機直式螢幕排版擁擠 |
| **還原多分割排版** | 再按一次 **`F9`** | 切換回工作區總覽 |
| **下達中文 / 語音指令** | 點擊鍵盤麥克風語音輸入 ➔ 按 `Enter` | 直接對 Claude/Codex 對話 |
| **新增右側 Pane** | 按 `Ctrl` ➔ 按 `b` ➔ 按 `v` | 左右分割新增視窗 |
| **新增下方 Pane** | 按 `Ctrl` ➔ 按 `b` ➔ 按 `-` | 上下分割新增視窗 |
| **關閉當前 Pane** | 按 `Ctrl` ➔ 按 `b` ➔ 按 `x` | 關閉不要的終端視窗 |
| **離開手機連線** | 直接關閉 Termius App 即可 | 背景 Agent 依然持續運作不受影響 |

---

## 7. 進階功能 1：跨國出差與全球連線原理

這套架構**完全支援跨國連線**（例如人在日本、美國、歐洲連回台灣電腦）：

* **全球中繼（Anycast DERP）**：Tailscale 在全球設有轉發節點。在國外出差時，手機自動就近連線至當地節點（如東京、舊金山），透過 WireGuard 自動穿透飯店/機場 Wi-Fi。
* **延遲容忍度高**：因為 herdr 互動本質是「輸入需求 ➔ Agent 執行 ➔ 閱讀結果」，即便跨國連線存在 100~150ms 延遲，打字與閱覽體驗依然順暢。
* **出國前檢查**：
  1. 電腦關閉自動睡眠（System Auto-Suspend）。
  2. BIOS 開啟 `AC Power Recovery`（遇跳電復電後自動開機）。

---

## 8. 進階功能 2：手機瀏覽本機網頁服務（如 `http://127.0.0.1:4317/`）

當您在 Linux 電腦上跑 Web 服務（如 Vite、FastAPI、Streamlit，或特定 4317 埠服務），若服務預設只綁定 `127.0.0.1`（本機），外部裝置無法直接連入。

以下提供 **2 種最順手的開啟方式**：

### 方式 A：使用 Termius 內建「Port Forwarding」（最安全、免改後端）
1. 打開手機 **Termius** ➔ 點擊底部 **「Port Forwarding（連接埠轉發 / Tunnels）」**。
2. 點擊 **「+」新增規則**：
   * **Name**：`Web-4317`
   * **Host**：選取 `My-Linux`
   * **Port（本機埠）**：`4317`
   * **Destination（遠端目標）**：`127.0.0.1`
   * **Destination Port（遠端埠）**：`4317`
3. 點擊啟用轉發（Start）。
4. 打開手機瀏覽器（Chrome/Safari），直接網址輸入：**`http://127.0.0.1:4317`** 或 **`http://localhost:4317`** 即可順利開啟！

### 方式 B：使用 Tailscale 內建 `tailscale serve`（一鍵發布到私網）
在 Linux 電腦終端機執行：
```bash
tailscale serve --bg 4317
```
指令會顯示一個僅限 tailnet 裝置存取的 HTTPS 網址。手機保持 Tailscale 已連線，直接在瀏覽器開啟該網址即可；可用 `tailscale serve status` 再次查看目前網址與轉發狀態。

要停止這項轉發時執行：

```bash
tailscale serve reset
```

---

## 9. 進階功能 3：Apple 裝置（iPhone/iPad）與家裡電腦連線指南

### 9.1 Apple iPhone / iPad 連線
1. **安裝 App**：從 App Store 下載 **Tailscale** 與 **Termius**（或 Blink Shell）。
2. **登入 Tailscale**：登入相同的帳號並啟動 VPN。
3. **Termius 設定**：填入 Host `<YOUR_TAILSCALE_IP>`、Port `22`、帳號密碼。
4. **iPad 額外優勢**：支援外接鍵盤、雙指右鍵手勢與 iPadOS 分割畫面（可一邊開 Safari 查資料，一邊開 Termius 操控 herdr）。

### 9.2 家裡電腦連線（Macbook / Windows PC）
人在家裡想用筆電直接連回主機：

* **Mac（macOS）**：
  1. 安裝 **Tailscale for Mac** 並登入。
  2. 打開內建「終端機（Terminal）」輸入：
     ```bash
     ssh <YOUR_USERNAME>@<YOUR_TAILSCALE_IP>
     herdr
     ```
  3. 若筆電也有裝 herdr，可直接用原生遠端命令：
     ```bash
     herdr --remote <YOUR_USERNAME>@<YOUR_TAILSCALE_IP>
     ```
* **Windows**：
  1. 安裝 **Tailscale for Windows** 並登入。
  2. 打開 Windows Terminal (PowerShell) 輸入：
     ```powershell
     ssh <YOUR_USERNAME>@<YOUR_TAILSCALE_IP>
     herdr
     ```

---

## 10. 進階功能 4：如何教另一位夥伴/同事連線（多人協作）

`herdr` 具備 Multi-attach 特性，多個人連入同一個 session 可以即時看見對方的畫面，非常適合遠端結對編程（Pair Programming）或教學。

### 步驟 A：讓夥伴加入網路（二選一）
* **同機構夥伴（推薦）**：讓夥伴的手機/電腦安裝 Tailscale，並使用相同的組織帳號登入。
* **跨帳號外部夥伴（Tailscale 節點分享）**：
  1. 您登入 [Tailscale Admin Console](https://login.tailscale.com/admin/machines)。
  2. 找到您電腦的節點名稱 ➔ 點擊 **「Share...（共享）」** 產生邀請連結。
  3. 夥伴點擊連結接受後，您的電腦就會出現在對方的 Tailscale 設備清單中。

### 步驟 B：提供夥伴連線權限
為維護安全性，建議在 Linux 主機為夥伴開立專屬帳號（避免共用您的個人密碼）：
```bash
# 建立新使用者
sudo adduser colleague_name

# 給予基本權限（可選）
sudo usermod -aG sudo colleague_name
```

### 步驟 C：夥伴連線指令
夥伴在手機 Termius 或電腦終端機輸入：
```bash
ssh colleague_name@<YOUR_TAILSCALE_IP>

# 進入 herdr 一起協作
herdr
```

---

## 11. 常見問題與故障排除（FAQ）

### Q1: 連線時顯示 `Connection timed out` 怎麼辦？
* **檢查 Tailscale 帳號**：確認手機與電腦是否登入同一個帳號/組織網域。
* **檢查手機 Tailscale 開關**：先將手機 Tailscale 關閉（OFF）等 2 秒再重新開啟（ON）。

### Q2: 出現 `Relay server unavailable` 警告？
* 4G 行動網路切換時的暫時性 Socket 延遲。
* **解法**：手機開啟「飛航模式」5 秒後關閉，再將 Tailscale App 往上滑掉強制重啟即可。

### Q3: 手機螢幕上無法模擬滑鼠右鍵？
* Android 觸控手勢預設不轉發 Mouse Button 3。請直接改用鍵盤快捷鍵（`Ctrl+b` 組合鍵或 `F9` 單鍵）操作，速度更快更精確。

---

## 結語
透過這套配置，您可以將 Linux 電腦打造成一台永不停歇的 AI 算力中心，無論人在何處、使用何種裝置，隨時都能以最高效率監控、驗收與指揮 AI 工作團隊！
