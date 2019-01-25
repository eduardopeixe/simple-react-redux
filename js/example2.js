class Score extends React.Component {
  CanvasRenderingContext2D() {
    return (
      <div>
        <h2>Score board fro the {this.props.teamName}</h2>
        <div>
          Score: 50 <br />
          <button>+</button>
          <button>-</button>
        </div>
      </div>
    );
  }
}

const el = document.getElementById('two');
ReactDom.render(<Score teamName="Tigers" />, el);
