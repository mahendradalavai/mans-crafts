import manLogo from '../assets/ChatGPT_Image_Aug_22__2026__02_50_39_PM-removebg-preview.png'

export default function Header({ cartCount, onOpenCart }) {
  return (
    <header className="site-header">
      <a className="brand" href="#/" aria-label="MAN home">
        <img className="wordmark" src={manLogo} alt="MAN logo" />
        <span>MAN</span>
      </a>
      <nav className="main-nav" aria-label="Main navigation">
        <a href="#shop">Shop</a>
        <a href="#story">Our story</a>
        <a href="#journal">Journal</a>
      </nav>
      <button className="cart-trigger" type="button" onClick={onOpenCart}>
        Bag <span aria-live="polite">{cartCount}</span>
      </button>
    </header>
  )
}
