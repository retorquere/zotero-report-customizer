import * as cleaner from 'clean-html'

const options = {
  'break-around-tags': ['body', 'blockquote', 'br', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'hr', 'link', 'meta', 'p', 'table', 'title', 'td', 'tr', 'th'],
}
export async function indent(html) {
  return new Promise(resolve => {
    cleaner.clean(html, options, resolve)
  })
}
