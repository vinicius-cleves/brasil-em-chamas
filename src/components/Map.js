import React, { Component } from 'react'
import { Map, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css';
import * as topojson from "topojson";
import Municipios_topojson from './municipio.json'
import ReactGA from 'react-ga';

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

function area(coords){
  return topojson.sphericalRingArea(coords) * 6371**2
}

function feature_area(feature){
  return area(feature.geometry.coordinates[0])
}

function winding_order_is_clockwise(coords){
  // Source: https://stackoverflow.com/questions/1165647/how-to-determine-if-a-list-of-polygon-points-are-in-clockwise-order
  let area = 0
  for(let i=0; i<coords.length-1; i++){
    area += (coords[i+1][0] - coords[i][0]) * (coords[i+1][1] + coords[i][1])
  }
  area += (coords[0][0] - coords[coords.length-1][0]) * (coords[0][1] + coords[coords.length-1][1])
  return area > 0
}

function fix_winding(coords){
  if(area(coords)<510e6/2){
    return coords
  } else {
    return coords.reverse()
  }
}

function get_subcoords(coords, npoints){
  return [...coords.slice(0, npoints), coords[0]]
}

function get_subregion(feature, target_area){
  const coords = feature.geometry.coordinates[0]
  let lower = 3
  let upper = coords.length
  let newpoint

  if(area(fix_winding(get_subcoords(coords, lower))) > target_area){
    return null
  }
  while (lower != upper - 1){
    // binary search
    newpoint = Math.ceil((lower + upper)/2)
    if(area(fix_winding(get_subcoords(coords, newpoint))) > target_area){
      upper = newpoint
    } else {
      lower = newpoint
    }
  }
  const subregion = {
    ...feature, 
    geometry:{
      ...feature.geometry,
      coordinates:[fix_winding(get_subcoords(coords, lower))],
      id: -1
    },
    properties:{
      ...feature.properties,
      codigo: -1,
      name: feature.properties.name + ' - partial'
    }
  }
  return subregion

}

function fill_area(cities, neighbors_idxs, initial_city, target_area){
  // TODO: Partial area at the end can be totally disconected from the main blob. Fix this
  
  let pushed_candidates = []
  const painted_cities = []
  let candidates = []
  let total_area = 0

  //Deals with initial city
  let candidates_with_area = [{
    city: initial_city,
    area: feature_area(initial_city)
  }]

  if(candidates_with_area[0].area < target_area){
    painted_cities.push(candidates_with_area[0].city)
    total_area += candidates_with_area[0].area
    pushed_candidates.push(candidates_with_area[0].city)
  }
  //Deals with neighbors
  while (pushed_candidates.length > 0){
    //populate candidates
    let painted_cities_ids = painted_cities.map(cur=>cur.id)
    candidates = pushed_candidates
      .map(cur=>find_neighbors(cur, cities, neighbors_idxs))
      .reduce((acc, cur, idx, arr)=>([...acc, ...cur]), [])
      .filter((cur, idx, arr)=>arr.findIndex(cur2=>cur2.id==cur.id)==idx)
      .filter(cur=>!painted_cities_ids.includes(cur.id))
    //calculate area for candidates
    candidates_with_area = candidates.map(cur=>({
      city: cur,
      area: feature_area(cur)
    })).sort((a, b) => (b.area - a.area))
    //Try to push candidates
    pushed_candidates = []
    for (let candidate of candidates_with_area){
      if (total_area + candidate.area <= target_area){
        painted_cities.push(candidate.city)
        total_area += candidate.area
        pushed_candidates.push(candidate.city)
      } 
    }
  }
  //Deals with incomplete neighbor to fill the remaining gap
  const smaller_candidate = candidates_with_area[candidates_with_area.length - 1]
  const subregion = get_subregion(smaller_candidate.city, target_area - total_area)
  if(subregion != null){
    painted_cities.push(subregion)
    total_area += feature_area(subregion)
  }

  return [painted_cities, total_area]
}

export default class MyMap extends Component {
  constructor(props){
    super(props)
    this.state = {
      painted_cities: null
    }
    const Municipios = topojson.feature(Municipios_topojson, Municipios_topojson.objects.Munic) 
    this.features_with_bbox = geojson_bbox(Municipios.features)
    const geometries = Municipios_topojson.objects.Munic.geometries
    this.neighbors_idxs = topojson.neighbors(geometries)
  }
  
  bindMap = (el) => {
    this.map = el.leafletElement;
  }

  onClick = (e) => {
    const features_with_bbox = this.features_with_bbox
    const neighbors_idxs = this.neighbors_idxs

    const {lng, lat} = e.latlng
    
    const point_city = find_point_region([lng, lat], features_with_bbox)
    if (point_city){
      const [painted_cities, total_area] = fill_area(features_with_bbox, neighbors_idxs, point_city, 23000) 
      const {codigo, name, uf} = point_city.properties
      ReactGA.event({
        category: 'Debugging',
        action: 'Total area',
        value: Math.ceil(total_area)
      })
      ReactGA.event({
        category: 'User',
        action: 'Selected city',
        label:  `${codigo}-${name}-${uf}`,
        value: 1
      })
      this.setState({painted_cities}, ()=>{
        //TODO: zoom on bound box of the painted region, not on the selected point
        this.map.flyTo({lng, lat}, 7.5, {
          animate: true,
          duration: 1
        })
      })
    }
    
  }

  render() {
    const {painted_cities} = this.state
    return (
      <Map 
        center={{
          lat: -12.503748,
          lng: -55.149975,
        }} 
        zoom={4} 
        style={{ width: '100%', height: '100%',}}
        ref={this.bindMap}
        onclick={this.onClick}
      >
      <TileLayer
        attribution='&copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      {painted_cities !== null && 
        <GeoJSON 
          key={painted_cities.map(cur=>cur.id).reduce((acc, cur)=>acc+cur)} 
          data={painted_cities} 
          style={{stroke: false, color:'#f00'}}/>}
      </Map>
      )
  }
}