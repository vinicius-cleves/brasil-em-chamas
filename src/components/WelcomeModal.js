import React, { Component } from 'react'
import ReactDOM from 'react-dom';
import Modal from 'react-modal';

Modal.setAppElement('#root');

const customStyles = {
  content : {
    top                   : '50%',
    // left                  : '50%',
    // right                 : 'auto',
    bottom                : 'auto',
    // marginRight           : '-50%',
    transform             : 'translate(0%, -50%)',
    borderRadius: '20px'
  },
  overlay: {
    zIndex: 1000,
    backgroundColor: 'rgba(255, 255, 255, 0.75)'
  }
};

export default class WelcomeModal extends Component {
  constructor(props){
    super(props)
    this.state = {isopen: true}
  }
  render(){
    return (
      <Modal
        isOpen={this.state.isopen}
        onRequestClose={()=>this.setState({isopen:false})}
        style={customStyles}
        contentLabel="Example Modal"
      >
        <h2 style={{textAlign: 'center'}}>E se fosse lá em casa?</h2>
        <p style={{textAlign: 'justify'}}>
          O pantanal está em chamas. São 23 mil km<sup>2</sup> destruídos pelo fogo só esse ano 
          <a href="https://g1.globo.com/natureza/noticia/2020/09/24/pantanal-bioma-mais-preservado-ate-2018-perdeu-ao-menos-10-vezes-mais-area-em-2020-que-em-18-anos.ghtml">
            [1]
          </a> 
          <a href="https://g1.globo.com/mt/mato-grosso/noticia/2020/09/09/area-queimada-no-pantanal-ja-passa-de-2-milhoes-de-hectares-tamanho-referente-a-10-vezes-as-cidades-de-sp-e-rj-juntas.ghtml">
            [2]
          </a>. 
          Sabe o quanto é isso? Clique no mapa e veja uma região 
          equivalente a destruida no pantanal só esse ano.
        </p>
        <p style={{textAlign: 'right', fontSize:'small', marginTop: '30px'}}>Encontrou um Bug? Nos ajude reportando-o em email.brasilemchamas@gmail.com</p>
      </Modal>
    )
  }
}
