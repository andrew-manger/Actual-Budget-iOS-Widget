// === 📦 CONFIGURATION VARIABLES ===

// 🔑 Your Actual Budget sync ID (found in settings > Advanced > Sync ID)
const syncId = "YOUR_SYNC_ID"

// 🔐 API key set in your actual-http-api server (matches `API_KEY` env var)
const apiKey = "YOUR_API_KEY"

// 🌐 Base URL of your actual-http-api instance (no trailing slash)
const apiBaseUrl = "https://your-actual-api.example.com"

// 📁 Name of the category group to show in the widget
const targetGroupName = "CATEGORY_GROUP_NAME"

// === 🎨 APPEARANCE SETTINGS ===

// Spacing between category lines
const itemSpacing = 4

// Font sizes
const textSize = 12                         // Category name
const balanceSize = 12                      // Category balance
const groupTitleSize = 16                   // Title: "📅 Month • 📂 Group"
const footerTextSize = 10                   // "Last updated" footer

// Text colors
const groupTitleColor = Color.blue()        // Title color
const footerTextColor = Color.gray()        // Footer color
const positiveColor = Color.green()         // Balance > 0
const zeroColor = Color.gray()              // Balance = 0
const negativeColor = Color.red()           // Balance < 0

// === 📅 DATE FORMATTING ===
const now = new Date()
const isoMonth = now.toISOString().slice(0, 7) // "2025-06"

const monthFormatter = new DateFormatter()
monthFormatter.dateFormat = "MMMM yyyy"
const prettyMonth = monthFormatter.string(now)

const timeFormatter = new DateFormatter()
timeFormatter.useNoDateStyle()
timeFormatter.useShortTimeStyle()

// === 📡 API REQUEST SETUP ===
const url = `${apiBaseUrl}/v1/budgets/${syncId}/months/${isoMonth}/categorygroups`

const req = new Request(url)
req.headers = {
  "x-api-key": apiKey,
  "accept": "application/json"
}

let w = new ListWidget()
let data, lastSuccessTime, failedNow = false

// === 🧠 Load from Scriptable's Keychain storage
let cache = null
if (Keychain.contains("actual-cache")) {
  const cachedRaw = Keychain.get("actual-cache")
  cache = JSON.parse(cachedRaw)
}

try {
  data = await req.loadJSON()
  const cachePayload = {
    timestamp: now.toISOString(),
    data: data
  }
  Keychain.set("actual-cache", JSON.stringify(cachePayload))
  lastSuccessTime = now
} catch (e) {
  console.error("API failed:", e)
  if (cache) {
    data = cache.data
    lastSuccessTime = new Date(cache.timestamp)
    failedNow = true
  } else {
    w.addText("❌ No data & no cache available.")
    Script.setWidget(w)
    Script.complete()
    return
  }
}

// === 📂 Find and display the category group
const groups = data.data
const targetGroup = groups.find(g => g.name === targetGroupName)

if (!targetGroup) {
  w.addText(`❌ Group '${targetGroupName}' not found`)
} else {
  const title = w.addText(`📅 ${prettyMonth} • 📂 ${targetGroup.name}`)
  title.font = Font.boldSystemFont(groupTitleSize)
  title.textColor = groupTitleColor
  w.addSpacer(itemSpacing)

  for (const cat of targetGroup.categories) {
    const stack = w.addStack()
    stack.layoutHorizontally()
    stack.centerAlignContent()

    const nameTxt = stack.addText(cat.name)
    nameTxt.font = Font.systemFont(textSize)
    nameTxt.textColor = Color.white()
    stack.addSpacer()

    const balance = (cat.balance / 100).toFixed(2)
    const balTxt = stack.addText(`£${balance}`)
    balTxt.font = Font.boldSystemFont(balanceSize)

    if (cat.balance > 0) balTxt.textColor = positiveColor
    else if (cat.balance < 0) balTxt.textColor = negativeColor
    else balTxt.textColor = zeroColor

    w.addSpacer(itemSpacing)
  }

  // === 🕓 Footer with status
  w.addSpacer(8)
  if (failedNow) {
    const failText = w.addText(`❌ Failed: ${timeFormatter.string(now)}`)
    failText.font = Font.systemFont(footerTextSize)
    failText.textColor = footerTextColor

    const lastText = w.addText(`🕓 Last retrieved: ${timeFormatter.string(lastSuccessTime)}`)
    lastText.font = Font.systemFont(footerTextSize)
    lastText.textColor = footerTextColor
  } else {
    const refreshText = w.addText(`🔄 Last retrieved: ${timeFormatter.string(lastSuccessTime)}`)
    refreshText.font = Font.systemFont(footerTextSize)
    refreshText.textColor = footerTextColor
  }
}

// 🕒 Auto-refresh: 6 hours if success, 30 mins if failed
const refreshInterval = failedNow ? 30 : 360 // in minutes
const nextRefresh = new Date(Date.now() + refreshInterval * 60 * 1000)
w.refreshAfterDate = nextRefresh

// 🧾 Display widget
w.setPadding(10, 10, 10, 10)
w.presentLarge()
Script.setWidget(w)
Script.complete()
