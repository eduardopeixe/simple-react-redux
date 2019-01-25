const Hello = createReactClass({
  render: function() {
    return <h1>Hello, World!</h1>;
  }
});

ReactDOM.render(<Hello />, document.getElementById('one'));
