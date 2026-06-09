// Footer lay nguyen HTML goc cua giao dien Moonlit
import footerHtml from '../../moonlit/footer.html?raw'

function Footer() {
  return <div dangerouslySetInnerHTML={{ __html: footerHtml }} />
}

export default Footer
