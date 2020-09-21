import React, { Component, Fragment } from 'react';
// import axios from 'axios';
import Map from './components/Map'


class App extends Component {
  state = {
    incidents: [],
  }
  render() {
    return (
      <Map incidents={this.state.incidents}/>
    );
  }
 }
 export default App;