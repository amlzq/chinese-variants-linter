[简体中文](README.md) | **English**

# Chinese Variants Linter

A browser extension that checks whether the Chinese text in web editing areas matches your target regional variant (glyph forms and regional vocabulary), and offers in-place correction suggestions.

Text is processed locally. It is useful for proofreading Chinese in content editing, customer-service scripts, form filling, and cross-region publishing.

## Features

- Four target variants: Simplified Chinese, Chinese (Taiwan), Chinese (Hong Kong), and Traditional Chinese.
- Detects glyph and regional-vocabulary differences in `textarea`, text `input`, and `contenteditable` areas.
- Checks automatically 300 ms after you stop typing, and immediately after pasting.
- Shows issues through in-page markers, a suggestion popover, and a review panel. You can replace each issue, ignore it once, or add the word to the allow list.
- Converts selected text, and writes the result back directly in editable areas.
- Configurable detection switch, detection strength, per-site enable/disable, allowed phrases, custom phrases, and shortcuts.
- Custom dictionaries are stored per target variant. They can be edited, and support import, export, template download, and clearing in CSV / OpenCC entry formats.
- Settings and dictionaries are stored in the browser's local storage.

## Install

- [Chrome Web Store](https://chromewebstore.google.com/detail/chinese-variants-linter/phnegnjebgcgjhdjedbpnejfplbfflbb)
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/chinese-variants-linter/nbdholbmndoilmlepmgmfnnmoimcfibg)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/chinese-variants-linter/)

## Usage

1. Open the extension popup and choose the target Chinese variant and detection strength.
2. "Check all sites by default" is off by default. When turned on, checking applies to every site. The site switch below it overrides that default for the current site.
3. Type, paste, or select text in an editing area on a site where checking is enabled.
4. Click an issue marker on the page, then replace it, ignore it, or add the word to the allow list.
5. Manage allowed phrases, custom phrases, and shortcuts in the popup.

## Terms of Service and Privacy Policy

- [Terms of Service](TERMS.md)
- [Privacy Policy](PRIVACY.md): the extension only declares the `storage` and `activeTab` permissions. Page text, dictionaries, and settings are processed locally and never sent to any server.

## License

[MIT](LICENSE)
