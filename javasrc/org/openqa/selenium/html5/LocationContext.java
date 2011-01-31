/*
Copyright 2007-2010 WebDriver committers
Copyright 2007-2010 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package org.openqa.selenium.html5;

public interface LocationContext {

  /**
   * Gets the physical location of the browser.
   *
   * @return A {@link Location} containing the location information. Returns null
   *     if the location is not available
   */
  Location location();

  /**
   * Sets the physical location.
   *
   * @param location A {@link Location} containing the new location information
   */
  void setLocation(Location location);
}
