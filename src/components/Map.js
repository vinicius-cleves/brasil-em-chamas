import React, { Component } from 'react'
import { Map, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css';
import * as topojson from "topojson";
import Municipios_topojson from './municipio.json'

function point_in_polygon(point, vs) {
  // ray-casting algorithm based on
  // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
  
  var x = point[0], y = point[1];
  
  var inside = false;
  for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      var xi = vs[i][0], yi = vs[i][1];
      var xj = vs[j][0], yj = vs[j][1];
      
      var intersect = ((yi > y) != (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
  }
  
  return inside;
};

function geojson_bbox(features){
  return features.map((feature, idx, arr)=>{
    const coors = feature.geometry.coordinates[0]
    const xs = coors.map((cur, idx, arr)=>(cur[0]))
    const ys = coors.map((cur, idx, arr)=>(cur[1]))
    
    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        bbox: {
          x: [Math.min(...xs), Math.max(...xs)], 
          y: [Math.min(...ys), Math.max(...ys)]
        }
      }
    }
  })
}

function point_in_bbox(point, bbox){
  return (
    (bbox.x[0]<point[0]) && (point[0]<bbox.x[1]) &&
    (bbox.y[0]<point[1]) && (point[1]<bbox.y[1]))
}

function find_point_region(point, features){
  const in_bbox = features.filter((cur, idx, arr)=>point_in_bbox(point, cur.geometry.bbox))
  return in_bbox.find((cur, idx, arr)=>point_in_polygon(point, cur.geometry.coordinates[0]))
}

function find_neighbors(target, cities, neighbors_idxs){
  // isso aqui pega o neighrbors calculado no topojjson e usa no geojson. Pode ser que ordem mude
  // e vai gerar um bug
  const idx = cities.findIndex((cur, idx, arr) => (cur.id === target.id))
  const feature_neighbors = neighbors_idxs[idx].map((cur, idx, arr)=>cities[cur])
  return feature_neighbors
}

function feature_area(feature){
  return topojson.sphericalRingArea(feature.geometry.coordinates[0]) * 6371**2
}

function fill_area(cities, neighbors_idxs, initial_city, target_area){
  // TODO: Deal with case where the selected city is bigger than target_area or the final 
  // total area is too far from target (because every city is too big)
  let pushed_candidates = [initial_city]
  const all_cities = [initial_city]
  let candidates = []
  let total_area = feature_area(initial_city)
  while (pushed_candidates.length > 0){
    //populate candidates
    let all_cities_ids = all_cities.map(cur=>cur.id)
    candidates = pushed_candidates
      .map(cur=>find_neighbors(cur, cities, neighbors_idxs))
      .reduce((acc, cur, idx, arr)=>([...acc, ...cur]), [])
      .filter((cur, idx, arr)=>arr.findIndex(cur2=>cur2.id==cur.id)==idx)
      .filter(cur=>!all_cities_ids.includes(cur.id))
    //calculate area for candidates
    const candidates_with_area = candidates.map(cur=>({
      city: cur,
      area: feature_area(cur)
    })).sort((a, b) => (b.area - a.area))
    //Try to push candidates
    pushed_candidates = []
    for (let candidate of candidates_with_area){
      if (total_area + candidate.area <= target_area){
        all_cities.push(candidate.city)
        total_area += candidate.area
        pushed_candidates.push(candidate.city)
      } 
    }
  }
  return [all_cities, total_area]

}

export default class MyMap extends Component {
  constructor(props){
    super(props)
    this.state = {
      coords: {
        lat: null,
        lng: null
      },
      lat: -12.503748,
      lng: -55.149975,
      zoom: 4,
    }
    const Municipios = topojson.feature(Municipios_topojson, Municipios_topojson.objects.Munic) 
    this.features_with_bbox = geojson_bbox(Municipios.features)
    const geometries = Municipios_topojson.objects.Munic.geometries
    this.neighbors_idxs = topojson.neighbors(geometries)
  }

  render() {
    const {lat, lng} = this.state.coords
    const features_with_bbox = this.features_with_bbox
    const neighbors_idxs = this.neighbors_idxs
    var all_cities = null
    var total_area = null
    if (lng !== null){
      const point_city = find_point_region([lng, lat], features_with_bbox)
      if (point_city){
        var [all_cities, total_area] = fill_area(features_with_bbox, neighbors_idxs, point_city, 23000)    
      }
    }
    
    console.log('rendering', total_area)
    return (
      <Map 
        center={[this.state.lat, this.state.lng]} 
        zoom={this.state.zoom} 
        style={{ width: '100%', height: '100%',}}
        onclick={(e)=>this.setState({coords:e.latlng})}
      >
      <TileLayer
        attribution='&copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      {all_cities !== null && 
        <GeoJSON 
          key={all_cities.map(cur=>cur.id).reduce((acc, cur)=>acc+cur)} 
          data={all_cities} 
          style={{stroke: false, color:'#f00'}}/>}
      </Map>
      )
  }
}