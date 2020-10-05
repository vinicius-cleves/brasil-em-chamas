import React, { Component, Fragment } from 'react';
// import axios from 'axios';
import Map from './components/Map'
import WelcomeModal from './components/WelcomeModal'
import ReactGA from 'react-ga';

ReactGA.initialize('UA-179640894-1');
ReactGA.pageview('/homepage');

class App extends Component {
  render() {
    return (
      <div style={{ width: '100%', height: '100%',}}>
        <WelcomeModal/>
        <Map/>
      </div>
      
    );
  }
 }
 export default App;