// Header lay nguyen HTML goc cua giao dien Moonlit (bao gom thanh dieu huong)
import headerHtml from '../../moonlit/header.html?raw'

function Header() {
  return <div dangerouslySetInnerHTML={{ __html: headerHtml }} />
}

export default Header
