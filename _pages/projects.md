---
layout: page
title: projects
permalink: /projects/
description: Selected research and robotics projects.
nav: true
nav_order: 2
---

<div class="projects">
{% assign selected_projects = site.projects | where: "category", "research" | sort: "importance" %}
<div class="row row-cols-1 row-cols-md-2">
{% for project in selected_projects %}
  {% include projects.liquid %}
{% endfor %}
</div>
</div>
