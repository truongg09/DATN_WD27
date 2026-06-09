// Trang chu lay nguyen phan noi dung goc cua giao dien Moonlit
import mainHtml from '../../moonlit/main.html?raw'

function Home() {
  return <div dangerouslySetInnerHTML={{ __html: mainHtml }} />
}

export default Home
