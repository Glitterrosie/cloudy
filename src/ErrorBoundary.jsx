import { Component } from 'react'

/** Nobody is watching this screen for a week. If React throws, a visitor should
 *  meet a friendly cloud and a button — never a white page. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="crash">
        <p className="crash__cloud" aria-hidden="true">
          ☁️
        </p>
        <h1>The sky needs a moment.</h1>
        <p>Nothing was lost — there is nothing saved to lose.</p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          Start again
        </button>
      </div>
    )
  }
}
