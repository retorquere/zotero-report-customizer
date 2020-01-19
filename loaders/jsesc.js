const jsesc = require('jsesc')
  
module.exports = function loader(source) {
  if (this.cacheable) this.cacheable()

  return `module.exports = '${jsesc(source, { compact: true})}';`
}
