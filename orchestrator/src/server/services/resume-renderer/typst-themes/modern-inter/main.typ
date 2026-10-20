// Modern Inter: a spacious, ATS-safe single-column resume theme.
// Every glyph is real, selectable text in reading order. Inter ships with the
// theme (see fonts/README.md), so rendering never depends on system or remote
// fonts.

#let data = json(__RESUME_DATA_PATH__)

#let accent = rgb("__ACCENT__")
#let ink = rgb("#1b1f24")
#let muted = rgb("#5a6270")
#let rule-color = rgb("#c8ced6")

#let entry-gap = 11pt

#let plain(value) = if type(value) == str { value.trim() } else { "" }

#set document(
  title: plain(data.at("name", default: "")),
  author: plain(data.at("name", default: "")),
)
#set page(paper: __PAGE_PAPER__, margin: __PAGE_MARGIN__)
#set text(
  font: "Inter",
  size: __BODY_SIZE__,
  fill: ink,
  lang: "en",
  hyphenate: false,
)
#set par(leading: __PAR_LEADING__, spacing: 0.75em, justify: false)

#show link: set text(fill: accent)
#show strong: set text(weight: "semibold")

// Section headings: small, tracked caps with a hairline rule beneath.
#show heading.where(level: 1): it => block(
  above: __SECTION_TOP__,
  below: __SECTION_BOTTOM__,
  sticky: true,
  width: 100%,
)[
  #set text(
    size: __SECTION_SIZE__,
    weight: "semibold",
    tracking: 0.09em,
    fill: accent,
  )
  #upper(it.body)
  #block(above: 4pt, below: 0pt, line(
    length: 100%,
    stroke: __LINE_WIDTH__ + rule-color,
  ))
]

// Entry headers (employer, school, project) with a right-aligned date.
#set grid(align: (left + bottom, right + bottom))
#show grid.cell.where(x: 1): it => {
  // Undated entries arrive as a literal "[]" placeholder; hide it.
  show "[]": none
  set text(fill: muted, features: ("tnum",))
  it
}
#show grid: it => block(above: entry-gap, below: 0pt, sticky: true, {
  set text(size: 11pt)
  show strong: set text(weight: "semibold", fill: ink)
  show link: set text(fill: ink)
  show emph: it => text(fill: muted, size: 0.9em, it.body)
  it
})

// Role lines directly under an entry header render upright in the accent
// color and stay on the same page as the bullets that follow. Emphasis inside
// bullets keeps its usual italic style.
#show emph: it => block(above: 5pt, below: 0pt, sticky: true, text(
  weight: "medium",
  fill: accent,
  it.body,
))

// Skill groups are separated by line breaks; give each group its own
// paragraph so groups read as distinct lines.
#show linebreak: v(0.1em)

#set list(
  marker: text(fill: muted)[•],
  indent: 0.15em,
  body-indent: 0.65em,
  spacing: 0.78em,
)
#show list: it => {
  show emph: it => text(style: "italic", it.body)
  // Keep short bullet lists in one piece so an entry is not split across
  // pages for the sake of one or two lines.
  block(above: 0.6em, breakable: it.children.len() > 3, it)
}

// Header: name, headline, then location and contact details as plain text.
#let header-items = {
  let items = ()
  let location = plain(data.at("location", default: none))
  if location != "" { items.push(location) }
  for item in data.at("contactItems", default: ()) {
    let label = plain(item.at("text", default: ""))
    if label == "" { continue }
    let url = plain(item.at("url", default: ""))
    items.push(if url == "" { label } else { link(url, label) })
  }
  items
}

#block(below: 6pt)[
  #set par(leading: 0.5em, spacing: 0pt)
  #text(size: __NAME_SIZE__, weight: "bold", tracking: -0.01em)[__NAME__]
  #let headline = plain(data.at("headline", default: none))
  #if headline != "" {
    block(above: 9pt, text(
      size: __HEADLINE_SIZE__,
      weight: "medium",
      fill: accent,
      headline,
    ))
  }
  #if header-items.len() > 0 {
    block(above: 9pt, text(size: __CONTACT_SIZE__, fill: muted, {
      show link: set text(fill: muted)
      header-items
        .map(item => box(item))
        .join(text(fill: rule-color)[#h(0.55em)|#h(0.55em)])
    }))
  }
]

__BODY__
