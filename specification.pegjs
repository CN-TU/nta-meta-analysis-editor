{
  function defChecker() {
    this.functions = new Map();
    this.verbs = new Map();
    this.addFunction = function(name, args, ret) {
      args = args[0];
      let id = args.length;
      if (typeof args[0] == "object" && args[0].type == "oneormore") {
        id = 0;
        args = args[0].term;
      }
      if (this.functions.has(name)) {
        if (this.functions.get(name)[id] !== undefined) {
          this.functions.get(name)[id].push([args,ret]);
        } else {
          this.functions.get(name)[id] = [[args, ret]];
        }
      } else {
        let arr = []
        arr[id] = [[args, ret]];
        this.functions.set(name, arr);
      }
    }
    this.addVerb = function(name, ret) {
      this.verbs.set(name, ret);
    }
    this.arguments = function(item, want, err) {
      switch(item.type) {
        case "feature":
        case "number":
        case "boolean":
          return null;
        case "operation":
          if (item.name.startsWith('__')) {
            return "<anything>";
          }
          if (item.name.startsWith('_')) {
            return "<anything>";
          }
          let variants = this.functions.get(item.name);
          if (variants === undefined) {
            item.error = "Function not found";
            err.push(item);
            return "<anything>";
          }
          let n = item.args.length;
          let ret = [];
          if (variants[n] !== undefined) {
            for(let i=0; i<variants[n].length; i++) {
              if (want == undefined || variants[n][i][1] == want) {
                ret.push(variants[n][i])
              }
            }
          }
          if (variants[0] !== undefined) {
            for(let i=0; i<variants[0].length; i++) {
              if (want == undefined || variants[0][i][1] == want) {
                ret.push([Array(n).fill(variants[0][i][0]), variants[0][i][1]])
              }
            }
          }
          return ret;
      }
    }
    this.isValid = function(item, want) {
      switch(item.type) {
        case "feature":
          return want == "<value>" || want == "<values>" || want == "<anything>"
        case "number":
          return want == "<value>" || want == "<anything>"
        case "boolean":
          return want == "<logic>" || want == "<anything>"
      }
      return false;
    }
  }

  var defs = new defChecker();

  function appendTerm(type, terms) {
      for(let i=0; i<terms.length; i++) {
          switch(typeof terms[i]) {
              case "string":
                  if (terms[i] == "<feature>" || type == "<feature>") {
                      continue;
                  }
                  defs.addVerb(terms[i], type);
                  continue;
              case "boolean":
                  defs.addVerb("<boolean>", type);
                  continue;
              case "object":
                  let key=Object.keys(terms[i])[0];
                  defs.addFunction(key, terms[i][key], type)
                  continue;
          }
      }
  }
}

Specifications
  = specs:(spec:Specification? [ \t]* '\n' {return spec;})* { return defs; }

Specification
  = [ \t]* Comment {} /
    [ \t]* type:Type _ "->" _ terms:Terms [ \t]* Comment? { appendTerm(type, terms); }

Terms
  = head:Value tail:(_ '|' _ t:Value { return t;})* { return [head].concat(tail); }

Value
  = Null /
    t:Type _ '+' { return {type: 'oneormore', term:t}; }  /
  	Type /
    Object /
    Array /
    String /
    Bool

Object
  ='{' _ prop:Properties _ '}' { return prop; }

Properties
  = head:Property tail:(_ ',' _ p:Property { return p; })* { return Object.assign({}, head, ...tail); }
  
Property
  = key:String _ ':' _ value:Terms { let ret = {}; ret[key] = value; return ret }

Array
  = '[' head:Value tail:(_ ',' _ t:Value {return t;})* ']' {return [head].concat(tail);} 

Type
  = '<' ([^>]+) '>' { return text(); }
  
String
  = '"' s:([^"]+ {return text();}) '"' { return s; }
  
Null
  = 'null'i { return null; }

Bool
  = ('true'i/'false'i) { return text().toLowerCase() == "true"; }

Comment "Comment"
  = '#' [^\n]*

_ "whitespace"
  = [ \t]* (Comment? '\n')* [ \t]*
              