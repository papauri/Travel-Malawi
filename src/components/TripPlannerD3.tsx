import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Hotel } from '../types';
import { useNavigate } from 'react-router-dom';

interface Props {
  hotels: Hotel[];
}

export default function TripPlannerD3({ hotels }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || hotels.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = 500;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg.attr("width", width).attr("height", height);

    // Group by location (simplified city/region extraction)
    const groupedData = d3.group(hotels, d => {
      const parts = (d.location || 'Unknown Location').split(',');
      return parts[0].trim();
    });

    const regions = Array.from(groupedData.entries()).map(([key, values]) => ({
      region: key,
      count: values.length,
      hotels: values
    }));

    // Color scale for regions
    const colorScale = d3.scaleOrdinal<string>()
      .domain(regions.map(r => r.region))
      .range(['#059669', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#f43f5e']);

    // Map View vs Distribution View (Let's do a Force-directed bubble chart)
    const nodes = hotels.map(h => {
      const parts = (h.location || 'Unknown Location').split(',');
      const region = parts[0].trim();
      return {
        ...h,
        region,
        radius: 20 + (Math.random() * 10), // slight size variation for aesthetic
        x: width / 2 + (Math.random() * 100 - 50),
        y: height / 2 + (Math.random() * 100 - 50)
      };
    });

    // Simulation
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => d.radius + 2).iterations(2))
      // Group by region logic: pull nodes of same region to specific focus points
      .force("x", d3.forceX((d: any) => {
        const index = regions.findIndex(r => r.region === d.region);
        const focusX = (width / (regions.length + 1)) * (index + 1);
        return focusX;
      }).strength(0.4))
      .force("y", d3.forceY(height / 2).strength(0.1));

    const tooltip = d3.select(containerRef.current)
      .append("div")
      .attr("class", "absolute hidden bg-stone-900 text-white text-xs px-3 py-2 rounded-xl shadow-xl z-20 pointer-events-none transform transition-opacity");

    // Draw links/lines connecting properties in the same region
    const links = [];
    for (const region of regions) {
      const regionNodes = nodes.filter(n => n.region === region.region);
      for (let i = 0; i < regionNodes.length - 1; i++) {
        links.push({
          source: regionNodes[i],
          target: regionNodes[i + 1]
        });
      }
    }

    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,4");

    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("mouseover", (event, d: any) => {
        d3.select(event.currentTarget).select("circle")
          .transition().duration(200)
          .attr("stroke", "#1c1917")
          .attr("stroke-width", 3);
          
        tooltip.classed("hidden", false)
          .html(`
            <div class="font-bold text-sm mb-1">${d.name}</div>
            <div class="text-stone-300 opacity-90">${d.region}</div>
          `)
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", (event, d: any) => {
        d3.select(event.currentTarget).select("circle")
          .transition().duration(200)
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 2);
        tooltip.classed("hidden", true);
      })
      .on("click", (event, d: any) => {
        navigate(`/hotel/${d.id}`);
      });

    node.append("circle")
      .attr("r", (d: any) => d.radius)
      .attr("fill", (d: any) => colorScale(d.region))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2)
      .attr("class", "shadow-sm drop-shadow-sm");

    node.append("text")
      .text((d: any) => d.name.substring(0, 1).toUpperCase())
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "#ffffff")
      .attr("font-size", "14px")
      .attr("font-weight", "bold");

    // Add region labels at the top
    const legend = svg.append("g")
      .attr("transform", `translate(0, 40)`);
      
    regions.forEach((r, i) => {
      const focusX = (width / (regions.length + 1)) * (i + 1);
      
      const g = legend.append("g")
        .attr("transform", `translate(${focusX}, 0)`);
        
      g.append("text")
        .text(r.region)
        .attr("text-anchor", "middle")
        .attr("fill", "#57534e")
        .attr("font-size", "14px")
        .attr("font-weight", "bold");
        
      g.append("text")
        .text(`${r.count} saved`)
        .attr("text-anchor", "middle")
        .attr("y", 18)
        .attr("fill", "#a8a29e")
        .attr("font-size", "12px");
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => {
        // Constrain within bounds
        d.x = Math.max(d.radius + 20, Math.min(width - d.radius - 20, d.x));
        d.y = Math.max(d.radius + 80, Math.min(height - d.radius - 20, d.y));
        return `translate(${d.x},${d.y})`;
      });
    });

    // Initial animation scale in
    node.attr("opacity", 0)
      .transition()
      .duration(1000)
      .attr("opacity", 1);

    return () => {
      simulation.stop();
      tooltip.remove();
    };

  }, [hotels, navigate]);

  return (
    <div className="w-full relative rounded-3xl bg-white border border-stone-200 overflow-hidden" ref={containerRef}>
      <div className="absolute top-4 left-6">
        <h3 className="font-bold text-stone-900 text-lg">Trip Distribution</h3>
        <p className="text-xs text-stone-500">Your saved properties grouped by region</p>
      </div>
      {hotels.length === 0 ? (
        <div className="h-[400px] flex items-center justify-center text-stone-500 font-medium">
          Save some properties to view your trip planner
        </div>
      ) : (
        <svg ref={svgRef} className="w-full h-[400px] md:h-[500px]"></svg>
      )}
    </div>
  );
}
