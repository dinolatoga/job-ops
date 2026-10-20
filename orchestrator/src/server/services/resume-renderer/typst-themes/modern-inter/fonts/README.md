# Bundled Inter fonts

These fonts are bundled so the Modern Inter theme renders identically in every
environment without fetching fonts at render time.

- Family: Inter
- Version: 4.1
- Source: https://github.com/rsms/inter/releases/tag/v4.1
- Archive: https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
- Archive SHA-256: `9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e`
- License: SIL Open Font License 1.1 (`OFL.txt`, copied from `LICENSE.txt` in
  the archive)

Only the static TTF weights the theme uses are included, copied unmodified from
`extras/ttf/` in the archive:

| File | SHA-256 |
| --- | --- |
| `Inter-Regular.ttf` | `40d692fce188e4471e2b3cba937be967878f631ad3ebbbdcd587687c7ebe0c82` |
| `Inter-Italic.ttf` | `bbc051dd204b5019a1aa0bc0ae2aa8a05ab13e7a3f979fa357631dc7feb6833a` |
| `Inter-Medium.ttf` | `97ad806f526e41546d46365bb3a393145f75b7b1568913db74549ad8b8dba872` |
| `Inter-SemiBold.ttf` | `78a843fade9d4612a5567302fb595b56976eb5fcebf4fea5a5912d638bafcde3` |
| `Inter-Bold.ttf` | `288316099b1e0a47a4716d159098005eef7c0066921f34e3200393dbdb01947f` |
| `Inter-BoldItalic.ttf` | `948405a16cdc62701da5f4005ed068ca5f4d27061d98f7974ccfc37831d9581d` |

Static instances are used instead of `InterVariable.ttf` because Typst selects
weights from separate font files more reliably than from variable axes.
